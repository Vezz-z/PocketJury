// ==============================================================================
// PocketJury API — AI Service Client (HTTP to Python FastAPI)
// ==============================================================================

import { env } from "../config/env";
import { logger } from "../utils/logger";

interface QueryInput {
  query: string;
  userId: string;
  chatId: string;
  personaMode: string;
  languageCode: string;
  chatHistory: Array<{ role: string; content: string }>;
}

interface QueryResponse {
  response: string;
  citedSections: Array<{
    documentId: string;
    title: string;
    documentType: string;
    section: string | null;
    relevanceScore: number;
    excerpt: string;
  }>;
  language: string;
  helplines: Array<{
    name: string;
    number: string;
    description: string;
    category: string;
  }>;
  disclaimer: string;
  metadata: {
    confidenceScore: number;
    processingTimeMs: number;
  };
}

interface SimplifyInput {
  originalResponse: string;
  languageCode: string;
  personaMode: string;
}

export class AIService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = env.AI_SERVICE_URL;
    this.timeout = 180000; // 180 seconds
  }

  /**
   * Standard (non-streaming) query — waits for full response.
   */
  async query(input: QueryInput): Promise<QueryResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: input.query,
          user_id: input.userId,
          chat_id: input.chatId,
          persona: input.personaMode,
          language: input.languageCode,
          message_history: input.chatHistory,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error({ status: response.status, error }, "AI service error");
        throw new Error(`AI service returned ${response.status}: ${error}`);
      }

      const data = await response.json();
      return {
        response: data.answer_translated || data.answer,
        citedSections: (data.references || []).map((ref: Record<string, unknown>) => ({
          documentId: ref.document_id,
          title: ref.title,
          documentType: ref.document_type,
          section: ref.section || null,
          relevanceScore: ref.relevance_score,
          excerpt: ref.excerpt || "",
        })),
        language: data.language_detected,
        helplines: (data.helplines || []).map((h: Record<string, unknown>) => ({
          name: h.name,
          number: h.phone,
          description: h.description,
          category: h.category,
        })),
        disclaimer: data.disclaimer,
        metadata: {
          confidenceScore: data.confidence_score || 0,
          processingTimeMs: data.processing_time_ms || 0,
        },
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Streaming query — returns a readable stream of SSE events from FastAPI.
   * The caller is responsible for piping this to the client response.
   */
  async queryStream(input: QueryInput): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/query/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: input.query,
          user_id: input.userId,
          chat_id: input.chatId,
          persona: input.personaMode,
          language: input.languageCode,
          message_history: input.chatHistory,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error({ status: response.status, error }, "AI stream service error");
        throw new Error(`AI stream service returned ${response.status}: ${error}`);
      }

      // Clear timeout — the stream will manage its own lifecycle
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  async simplify(input: SimplifyInput): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/simplify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input.originalResponse,
          language: input.languageCode,
          persona: input.personaMode,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      const data = await response.json();
      return data.simplified_text;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async generateTitle(query: string, languageCode = 'en'): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/generate-title`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, language_code: languageCode }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      const data = await response.json();
      return data.title || query.slice(0, 40);
    } catch (err) {
      logger.warn({ err }, "Title generation failed, falling back to query text");
      return query.length > 40 ? query.slice(0, 40) + "…" : query;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export const aiService = new AIService();
