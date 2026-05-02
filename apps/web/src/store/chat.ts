// ==============================================================================
// PocketJury — Zustand Chat Store
// ==============================================================================

import { create } from 'zustand';
import { chatApi, feedbackApi } from '@/lib/api';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Array<{
    documentId: string;
    title: string;
    documentType: string;
    section?: string;
    relevanceScore: number;
    excerpt: string;
  }>;
  helplines?: Array<{
    name: string;
    phone: string;
    description: string;
    category: string;
  }>;
  ipcBnsNote?: string;
  confidenceScore?: number;
  processingTimeMs?: number;
  simplifiedContent?: string;
  feedbackRating?: 'HELPFUL' | 'NOT_HELPFUL';
  createdAt: string;
}

interface Chat {
  id: string;
  title: string;
  messagesCount: number;
  lastMessage?: string;
  updatedAt: string;
  messages?: Message[];
}

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  isSimplifyingMessageId: string | null;
  error: string | null;

  fetchChats: () => Promise<void>;
  createChat: () => Promise<string>;
  selectChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  renameChat: (chatId: string, title: string) => Promise<void>;
  sendMessage: (chatId: string, query: string) => Promise<void>;
  stopStreaming: () => void;
  simplifyMessage: (chatId: string, messageId: string) => Promise<void>;
  submitFeedback: (messageId: string, rating: 'HELPFUL' | 'NOT_HELPFUL', comment?: string) => Promise<void>;
  clearError: () => void;
}

// Module-level refs for stream management
let _activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let _activeStreamChatId: string | null = null; // Which chat is currently streaming

export const useChatStore = create<ChatState>()((set, get) => ({
  chats: [],
  activeChat: null,
  isLoadingChats: false,
  isLoadingMessages: false,
  isSending: false,
  isStreaming: false,
  streamingMessageId: null,
  isSimplifyingMessageId: null,
  error: null,

  fetchChats: async () => {
    set({ isLoadingChats: true });
    try {
      const data = await chatApi.list();
      const rawList = Array.isArray(data) ? data : Array.isArray(data?.chats) ? data.chats : Array.isArray(data?.data) ? data.data : [];
      const chatList = rawList.map((c: any) => ({
        ...c,
        lastMessage: c.lastMessage || null,
      }));
      set({ chats: chatList, isLoadingChats: false });
    } catch (err: unknown) {
      set({ chats: [], error: 'Failed to load chats', isLoadingChats: false });
    }
  },

  createChat: async () => {
    const data = await chatApi.create();
    const newChat: Chat = {
      id: data.id,
      title: data.title || 'New Chat',
      messagesCount: 0,
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    set((state) => ({
      chats: [newChat, ...state.chats],
      activeChat: newChat,
    }));
    return data.id;
  },

  selectChat: async (chatId) => {
    // If switching away from a streaming chat, DON'T cancel the reader.
    // The background stream continues; the reader is only cancelled via stopStreaming.
    const prev = get();
    if (prev.isStreaming && prev.activeChat?.id && prev.activeChat.id !== chatId) {
      // Reset UI state only — the stream reader continues in the background
      set({ isSending: false, isStreaming: false, streamingMessageId: null });
    }

    set({ isLoadingMessages: true });
    try {
      const data = await chatApi.get(chatId);
      const normalizedMessages = (data.messages || []).map((m: Record<string, unknown>) => ({
        ...m,
        role: typeof m.role === 'string' ? m.role.toLowerCase() : m.role,
      }));
      const chat: Chat = {
        id: data.id,
        title: data.title,
        messagesCount: normalizedMessages.length,
        updatedAt: data.updatedAt,
        messages: normalizedMessages,
      };
      set({ activeChat: chat, isLoadingMessages: false });
    } catch {
      set({ error: 'Failed to load chat', isLoadingMessages: false });
    }
  },

  deleteChat: async (chatId) => {
    const previousChats = get().chats;
    const previousActiveChat = get().activeChat;

    // Optimistically remove the chat
    set((state) => ({
      chats: state.chats.filter((c) => c.id !== chatId),
      activeChat: state.activeChat?.id === chatId ? null : state.activeChat,
    }));

    try {
      await chatApi.delete(chatId);
    } catch (err) {
      // Restore on failure
      set({ chats: previousChats, activeChat: previousActiveChat, error: 'Failed to delete chat' });
      throw err;
    }
  },

  renameChat: async (chatId, title) => {
    const previousChats = get().chats;
    // Optimistic update
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, title } : c)),
      activeChat: state.activeChat?.id === chatId ? { ...state.activeChat, title } : state.activeChat,
    }));
    try {
      await chatApi.update(chatId, { title });
    } catch {
      set({ chats: previousChats, error: 'Failed to rename chat' });
    }
  },

  sendMessage: async (chatId, query) => {
    // Optimistically add user message
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: query,
      createdAt: new Date().toISOString(),
    };

    // Add a placeholder assistant message that will be populated via streaming
    const streamingAssistantId = `streaming-${Date.now()}`;
    const streamingAssistant: Message = {
      id: streamingAssistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    // Keep title as "New Chat" — the LLM-generated title will arrive via polling.
    const currentTitle = get().activeChat?.title;
    const isGenericTitle = !currentTitle || currentTitle === 'New Chat' || currentTitle === 'Untitled Chat';

    set((state) => ({
      isSending: true,
      isStreaming: false,
      activeChat: state.activeChat
        ? {
          ...state.activeChat,
          messages: [...(state.activeChat.messages || []), userMessage],
        }
        : state.activeChat,
    }));

    // Start title polling immediately for first messages
    // (backend now fires generateTitle before the stream, so it arrives faster)
    if (isGenericTitle) {
      const pollForTitle = (attemptsLeft: number) => {
        if (attemptsLeft <= 0) return;
        setTimeout(() => {
          chatApi.get(chatId).then((updatedChat: any) => {
            const newTitle = updatedChat?.title;
            if (newTitle && newTitle !== currentTitle && newTitle !== 'New Chat') {
              set((state) => ({
                activeChat: state.activeChat?.id === chatId
                  ? { ...state.activeChat, title: newTitle }
                  : state.activeChat,
                chats: state.chats.map((c) =>
                  c.id === chatId ? { ...c, title: newTitle } : c,
                ),
              }));
            } else {
              pollForTitle(attemptsLeft - 1);
            }
          }).catch(() => {});
        }, 3000);
      };
      pollForTitle(6);
    }

    try {
      // Try streaming first
      const response = await chatApi.sendMessageStream(chatId, query);

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      // Track which chat this stream belongs to
      _activeStreamChatId = chatId;

      // Add the empty assistant message placeholder (only if still on same chat)
      set((state) => ({
        isStreaming: state.activeChat?.id === chatId ? true : state.isStreaming,
        streamingMessageId: state.activeChat?.id === chatId ? streamingAssistantId : state.streamingMessageId,
        activeChat: state.activeChat?.id === chatId
          ? {
            ...state.activeChat,
            messages: [...(state.activeChat.messages || []), streamingAssistant],
          }
          : state.activeChat,
      }));

      // Parse SSE stream
      const reader = response.body.getReader();
      _activeReader = reader; // Store ref so stopStreaming can cancel
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      let metadata: Record<string, unknown> = {};
      let wasCancelled = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events (separated by double newline)
          const events = buffer.split('\n\n');
          buffer = events.pop() || ''; // Keep incomplete last event in buffer

          for (const eventBlock of events) {
            if (!eventBlock.trim()) continue;

            const eventMatch = eventBlock.match(/^event: (\w+)\ndata: (.+)$/s);
            if (!eventMatch) continue;

            const [, eventType, eventData] = eventMatch;
            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(eventData);
            } catch {
              continue;
            }

            switch (eventType) {
              case 'metadata':
                metadata = parsed;
                // Only update UI if user is still viewing this chat
                if (get().activeChat?.id === chatId) {
                  set((state) => ({
                    activeChat: state.activeChat?.id === chatId
                      ? {
                        ...state.activeChat,
                        messages: (state.activeChat.messages || []).map((m) =>
                          m.id === streamingAssistantId
                            ? {
                              ...m,
                              references: parsed.references as Message['references'],
                              helplines: parsed.helplines as Message['helplines'],
                              ipcBnsNote: parsed.ipc_bns_note as string | undefined,
                              confidenceScore: parsed.confidence_score as number | undefined,
                            }
                            : m,
                        ),
                      }
                      : state.activeChat,
                  }));
                }
                break;

              case 'token':
                accumulatedContent += (parsed.text as string) || '';
                // Only update UI if user is still viewing this chat
                if (get().activeChat?.id === chatId) {
                  set((state) => ({
                    activeChat: state.activeChat?.id === chatId
                      ? {
                        ...state.activeChat,
                        messages: (state.activeChat.messages || []).map((m) =>
                          m.id === streamingAssistantId
                            ? { ...m, content: accumulatedContent }
                            : m,
                        ),
                      }
                      : state.activeChat,
                  }));
                }
                break;

              case 'done': {
                const finalContent = accumulatedContent || (parsed.answer_translated as string) || (parsed.answer as string) || '';
                const isStillOnChat = get().activeChat?.id === chatId;
                if (isStillOnChat) {
                  set((state) => ({
                    isSending: false,
                    isStreaming: false,
                    streamingMessageId: null,
                    activeChat: state.activeChat?.id === chatId
                      ? {
                        ...state.activeChat,
                        messages: (state.activeChat.messages || []).map((m) =>
                          m.id === streamingAssistantId
                            ? { ...m, content: finalContent, processingTimeMs: parsed.processing_time_ms as number | undefined }
                            : m,
                        ),
                      }
                      : state.activeChat,
                  }));
                }
                break;
              }

              case 'blocked': {
                const blockedContent = (parsed.message as string) || 'This query has been blocked by safety filters.';
                if (get().activeChat?.id === chatId) {
                  set((state) => ({
                    isSending: false,
                    isStreaming: false,
                    streamingMessageId: null,
                    activeChat: state.activeChat?.id === chatId
                      ? {
                        ...state.activeChat,
                        messages: (state.activeChat.messages || []).map((m) =>
                          m.id === streamingAssistantId
                            ? { ...m, content: blockedContent }
                            : m,
                        ),
                      }
                      : state.activeChat,
                  }));
                }
                break;
              }

              case 'error': {
                const errMsg = (parsed.message as string) || 'An error occurred while processing your query.';
                if (get().activeChat?.id === chatId) {
                  set((state) => ({
                    isSending: false,
                    isStreaming: false,
                    streamingMessageId: null,
                    activeChat: state.activeChat?.id === chatId
                      ? {
                        ...state.activeChat,
                        messages: (state.activeChat.messages || []).map((m) =>
                          m.id === streamingAssistantId
                            ? { ...m, content: `⚠️ **Error:** ${errMsg}` }
                            : m,
                        ),
                      }
                      : state.activeChat,
                  }));
                }
                break;
              }
            }
          }
        }
      } catch (readErr: any) {
        // reader.cancel() throws — this is expected when user stops streaming
        if (readErr?.message?.includes('cancel') || readErr?.name === 'AbortError') {
          wasCancelled = true;
        } else {
          throw readErr;
        }
      } finally {
        _activeReader = null;
      }

      // If cancelled by user, keep accumulated content as the final message
      if (wasCancelled) {
        if (get().activeChat?.id === chatId) {
          set({ isSending: false, isStreaming: false, streamingMessageId: null });
        }
        return;
      }

      // Clean up streaming state only if we're still on the same chat
      const isStillOnThisChat = get().activeChat?.id === chatId;
      if (isStillOnThisChat) {
        set({ isSending: false, isStreaming: false, streamingMessageId: null });
      } else {
        // Stream finished in the background — notify the user
        _activeStreamChatId = null;
        const chatTitle = get().chats.find((c) => c.id === chatId)?.title || 'a chat';
        const locale = typeof window !== 'undefined' ? (window.location.pathname.split('/')[1] || 'en') : 'en';
        toast.info(`Response ready in "${chatTitle}"`, {
          duration: 10000,
          action: {
            label: 'View',
            onClick: () => { window.location.href = `/${locale}/chat/${chatId}`; },
          },
        });
      }

    } catch (err: any) {
      // Only update UI if we're still on the same chat
      if (get().activeChat?.id !== chatId) return;

      let errorMessage = 'Assistant unavailable at the moment.';

      if (err.name === 'AbortError' || err.message?.toLowerCase().includes('timeout') || err.message?.includes('Failed to fetch')) {
        errorMessage = 'Assistant response has timed-out. It taking longer than expected, possibly due to high load on the free tier API. Please try your question again.';
      } else if (err.status === 429) {
        errorMessage = 'Assistant has reached the message limit. Please wait a few moments before sending another message.';
      } else if (err.status === 503) {
        errorMessage = 'Assistant unavailable at the moment. The backend service may be offline or restarting.';
      } else if (err.status >= 500) {
        errorMessage = 'Assistant facing internal issues. Our servers are currently experiencing problems (Status: ' + err.status + ').';
      } else if (!err.status) {
        errorMessage = 'Assistant is unable to reach the API service. Please check your internet connection and verify the API is running.';
      }

      const errorAssistantMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Error:** ${errorMessage}`,
        createdAt: new Date().toISOString(),
      };

      chatApi.createSystemMessage(chatId, errorAssistantMessage.content).catch(console.error);

      set((state) => {
        const messages = (state.activeChat?.messages || []).filter(
          (m) => m.id !== streamingAssistantId
        );
        return {
          isSending: false,
          isStreaming: false,
          activeChat: state.activeChat?.id === chatId
            ? {
              ...state.activeChat,
              messages: [...messages, errorAssistantMessage],
            }
            : state.activeChat,
          error: null,
        };
      });
    }
  },

  stopStreaming: () => {
    // Cancel the active stream reader only for the current chat
    if (_activeReader && _activeStreamChatId === get().activeChat?.id) {
      _activeReader.cancel().catch(() => {});
      _activeReader = null;
      _activeStreamChatId = null;
    }
    set({ isSending: false, isStreaming: false, streamingMessageId: null });
  },

  simplifyMessage: async (chatId, messageId) => {
    const currentState = get();
    const activeChat = currentState.activeChat;
    if (!activeChat || !activeChat.messages) return;

    const targetIndex = activeChat.messages.findIndex((m) => m.id === messageId);
    if (targetIndex === -1) return;

    // Optimistically truncate: remove the target message and everything below
    const truncatedMessages = activeChat.messages.slice(0, targetIndex);

    set({
      isSimplifyingMessageId: messageId,
      activeChat: { ...activeChat, messages: truncatedMessages },
    });

    try {
      // Call the simplify API (backend replaces content + deletes subsequent messages)
      await chatApi.simplify(chatId, messageId);

      // Re-fetch the full chat to get the server-authoritative state
      const data = await chatApi.get(chatId);
      const normalizedMessages = (data.messages || []).map((m: Record<string, unknown>) => ({
        ...m,
        role: typeof m.role === 'string' ? m.role.toLowerCase() : m.role,
      }));

      set((state) => ({
        activeChat: state.activeChat
          ? { ...state.activeChat, messages: normalizedMessages }
          : state.activeChat,
      }));
    } catch (error) {
      console.error('Failed to simplify message:', error);
      // Restore original messages on failure
      set((state) => ({
        activeChat: state.activeChat
          ? { ...state.activeChat, messages: activeChat.messages }
          : state.activeChat,
      }));
    } finally {
      set({ isSimplifyingMessageId: null });
    }
  },

  submitFeedback: async (messageId, rating, comment) => {
    await feedbackApi.submit({ messageId, rating, comment });
    set((state) => ({
      activeChat: state.activeChat
        ? {
          ...state.activeChat,
          messages: state.activeChat.messages?.map((m) =>
            m.id === messageId ? { ...m, feedbackRating: rating } : m,
          ),
        }
        : state.activeChat,
    }));
  },

  clearError: () => set({ error: null }),
}));
