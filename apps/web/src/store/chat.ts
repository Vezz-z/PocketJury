// ==============================================================================
// PocketJury — Zustand Chat Store
// ==============================================================================

import { create } from 'zustand';
import { chatApi, feedbackApi } from '@/lib/api';

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
  hasUnread?: boolean;
}

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  streamingChatIds: string[]; // Which chats are streaming (for sidebar indicators)
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
let _activeStreamChatId: string | null = null;

// Background streams: tracks streaming state for chats the user navigated away from
interface BackgroundStream {
  messages: Message[];
  streamingMessageId: string;
}
const _backgroundStreams = new Map<string, BackgroundStream>();
// Accumulated content per streaming message (shared between foreground + background)
const _streamContent = new Map<string, string>(); // streamingMessageId -> accumulated text
// Cache processingTimeMs for streams that complete while user is on a different chat
const _completedStreamMeta = new Map<string, { streamMsgId: string; processingTimeMs?: number }>(); // chatId -> meta

export const useChatStore = create<ChatState>()((set, get) => ({
  chats: [],
  activeChat: null,
  isLoadingChats: false,
  isLoadingMessages: false,
  isSending: false,
  isStreaming: false,
  streamingMessageId: null,
  streamingChatIds: [],
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
    const prev = get();
    const prevChatId = prev.activeChat?.id;

    // If switching away from a streaming chat, save its state for later restoration
    if (prev.isStreaming && prevChatId && prevChatId !== chatId && prev.streamingMessageId) {
      _backgroundStreams.set(prevChatId, {
        messages: prev.activeChat?.messages || [],
        streamingMessageId: prev.streamingMessageId,
      });
      // Reset UI streaming flags — streamingChatIds keeps the pulsating icon
      set({ isSending: false, isStreaming: false, streamingMessageId: null });
    }

    // Clear hasUnread for this chat
    set((state) => ({
      chats: state.chats.map((c) => c.id === chatId ? { ...c, hasUnread: false } : c),
    }));

    // If the stream reader is currently pumping for this chat (e.g. navigating from /chat/new),
    // DON'T fetch from server — sendMessage already has activeChat set up correctly.
    if (_activeStreamChatId === chatId && !_backgroundStreams.has(chatId)) {
      // Restore full streaming state so the UI resumes properly
      const currentStreamMsgId = Array.from(_streamContent.keys()).find((k) => k.startsWith('streaming-'));
      set({
        isLoadingMessages: false,
        isSending: true,
        isStreaming: true,
        streamingMessageId: currentStreamMsgId || get().streamingMessageId,
      });
      return;
    }

    // Check if we have a background stream for this chat — restore instead of fetching
    const bg = _backgroundStreams.get(chatId);
    if (bg) {
      const latestContent = _streamContent.get(bg.streamingMessageId) || '';
      const restoredMessages = bg.messages.map((m) =>
        m.id === bg.streamingMessageId ? { ...m, content: latestContent } : m,
      );
      _backgroundStreams.delete(chatId);

      const chat: Chat = {
        id: chatId,
        title: prev.chats.find((c) => c.id === chatId)?.title || 'New Chat',
        messagesCount: restoredMessages.length,
        updatedAt: new Date().toISOString(),
        messages: restoredMessages,
      };
      set({
        activeChat: chat,
        isLoadingMessages: false,
        isSending: true,
        isStreaming: true,
        streamingMessageId: bg.streamingMessageId,
      });
      return;
    }

    // Normal fetch from server
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

      // Merge cached processingTimeMs from background-completed streams
      const meta = _completedStreamMeta.get(chatId);
      if (meta && chat.messages) {
        const msgs = chat.messages;
        chat.messages = msgs.map((m) => {
          if (meta.streamMsgId && m.role === 'assistant' && m === msgs[msgs.length - 1]) {
            return { ...m, processingTimeMs: meta.processingTimeMs };
          }
          return m;
        });
        _completedStreamMeta.delete(chatId);
      }

      // Always reset streaming flags — this chat is fully loaded from server
      set({ activeChat: chat, isLoadingMessages: false, isSending: false, isStreaming: false, streamingMessageId: null });
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

    // Mark this chat as having an active stream BEFORE the API call,
    // so selectChat can detect it if the user navigates while we await.
    _activeStreamChatId = chatId;

    // Add user message to activeChat — create activeChat if it doesn't exist
    set((state) => {
      const existing = state.activeChat?.id === chatId ? state.activeChat : null;
      const chat: Chat = existing
        ? { ...existing, messages: [...(existing.messages || []), userMessage] }
        : { id: chatId, title: 'New Chat', messagesCount: 1, updatedAt: new Date().toISOString(), messages: [userMessage] };
      return {
        isSending: true,
        isStreaming: false,
        activeChat: chat,
      };
    });

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

      _streamContent.set(streamingAssistantId, '');

      // Add the empty assistant message placeholder — always update activeChat
      set((state) => {
        const isOnThisChat = state.activeChat?.id === chatId;
        return {
          isStreaming: isOnThisChat ? true : state.isStreaming,
          streamingMessageId: isOnThisChat ? streamingAssistantId : state.streamingMessageId,
          streamingChatIds: state.streamingChatIds.includes(chatId)
            ? state.streamingChatIds
            : [...state.streamingChatIds, chatId],
          activeChat: isOnThisChat
            ? {
              ...state.activeChat!,
              messages: [...(state.activeChat!.messages || []), streamingAssistant],
            }
            : state.activeChat,
        };
      });

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
                // Always track in _streamContent for background restore
                _streamContent.set(streamingAssistantId, accumulatedContent);
                // Update UI if user is viewing this chat
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
                } else {
                  // Update background stream messages snapshot
                  const bgEntry = _backgroundStreams.get(chatId);
                  if (bgEntry) {
                    bgEntry.messages = bgEntry.messages.map((m) =>
                      m.id === streamingAssistantId ? { ...m, content: accumulatedContent } : m,
                    );
                  }
                }
                break;

              case 'done': {
                const finalContent = accumulatedContent || (parsed.answer_translated as string) || (parsed.answer as string) || '';
                const ptMs = parsed.processing_time_ms as number | undefined;
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
                            ? { ...m, content: finalContent, processingTimeMs: ptMs }
                            : m,
                        ),
                      }
                      : state.activeChat,
                  }));
                } else {
                  // Stream finished in background — update _backgroundStreams if present
                  const bgEntry = _backgroundStreams.get(chatId);
                  if (bgEntry) {
                    bgEntry.messages = bgEntry.messages.map((m) =>
                      m.id === streamingAssistantId
                        ? { ...m, content: finalContent, processingTimeMs: ptMs }
                        : m,
                    );
                  }
                  // Cache meta for later retrieval when user switches back
                  _completedStreamMeta.set(chatId, { streamMsgId: streamingAssistantId, processingTimeMs: ptMs });
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
        _streamContent.delete(streamingAssistantId);
        _backgroundStreams.delete(chatId);
        _activeStreamChatId = null;
        // Always clear streaming state — even if user navigated away
        set((state) => ({
          isSending: state.activeChat?.id === chatId ? false : state.isSending,
          isStreaming: state.activeChat?.id === chatId ? false : state.isStreaming,
          streamingMessageId: state.activeChat?.id === chatId ? null : state.streamingMessageId,
          streamingChatIds: state.streamingChatIds.filter((id) => id !== chatId),
        }));
        return;
      }

      // Clean up tracking
      _streamContent.delete(streamingAssistantId);
      _backgroundStreams.delete(chatId);
      _activeStreamChatId = null;

      const isStillOnThisChat = get().activeChat?.id === chatId;
      if (isStillOnThisChat) {
        set((state) => ({ isSending: false, isStreaming: false, streamingMessageId: null, streamingChatIds: state.streamingChatIds.filter((id) => id !== chatId) }));

        // Re-fetch the chat from the server to replace temporary message IDs
        // (streaming-*) with real database UUIDs. Without this, operations like
        // "Simplify" fail because the backend can't find the temp ID in the DB.
        try {
          const data = await chatApi.get(chatId);
          const serverMessages = (data.messages || []).map((m: Record<string, unknown>) => ({
            ...m,
            role: typeof m.role === 'string' ? m.role.toLowerCase() : m.role,
          }));

          // Preserve client-only fields (processingTimeMs, confidenceScore) that
          // the DB doesn't store — merge them from the current activeChat messages.
          const currentMessages = get().activeChat?.messages || [];
          const mergedMessages = serverMessages.map((sm: Message, idx: number) => {
            // Match by position: the last messages align between client & server
            const clientMsg = currentMessages[idx];
            if (clientMsg && sm.role === clientMsg.role) {
              return {
                ...sm,
                processingTimeMs: sm.processingTimeMs ?? clientMsg.processingTimeMs,
                confidenceScore: sm.confidenceScore ?? clientMsg.confidenceScore,
              };
            }
            return sm;
          });

          set((state) => ({
            activeChat: state.activeChat?.id === chatId
              ? { ...state.activeChat, messages: mergedMessages }
              : state.activeChat,
          }));
        } catch {
          // Non-critical: simplify may fail later, but the chat still works
        }
      } else {
        // Stream finished in the background — mark unread + dispatch event for toast
        set((state) => ({
          streamingChatIds: state.streamingChatIds.filter((id) => id !== chatId),
          chats: state.chats.map((c) => c.id === chatId ? { ...c, hasUnread: true } : c),
        }));
        // Dispatch a custom event so a React component can show a localized toast
        if (typeof window !== 'undefined') {
          const chatTitle = get().chats.find((c) => c.id === chatId)?.title || 'Chat';
          window.dispatchEvent(new CustomEvent('pocketjury:bg-stream-done', {
            detail: { chatId, chatTitle },
          }));
        }
      }

    } catch (err: any) {
      _activeStreamChatId = null;
      _streamContent.delete(streamingAssistantId);
      _backgroundStreams.delete(chatId);

      // Always clear streaming indicator for this chat
      set((state) => ({
        streamingChatIds: state.streamingChatIds.filter((id) => id !== chatId),
      }));

      // Only update UI error state if we're still on the same chat
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
          streamingChatIds: state.streamingChatIds.filter((id) => id !== chatId),
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
    const currentChatId = get().activeChat?.id;
    set((state) => ({
      isSending: false,
      isStreaming: false,
      streamingMessageId: null,
      streamingChatIds: currentChatId
        ? state.streamingChatIds.filter((id) => id !== currentChatId)
        : state.streamingChatIds,
    }));
  },

  simplifyMessage: async (chatId, messageId) => {
    const currentState = get();
    const activeChat = currentState.activeChat;
    if (!activeChat || !activeChat.messages) return;

    const targetIndex = activeChat.messages.findIndex((m) => m.id === messageId);
    if (targetIndex === -1) return;

    // Keep everything before the target message, then add a streaming placeholder
    const truncatedMessages = activeChat.messages.slice(0, targetIndex);
    const simplifyStreamId = `simplify-${Date.now()}`;
    const streamingPlaceholder: Message = {
      id: simplifyStreamId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    set({
      isSimplifyingMessageId: messageId,
      isStreaming: true,
      streamingMessageId: simplifyStreamId,
      activeChat: { ...activeChat, messages: [...truncatedMessages, streamingPlaceholder] },
    });

    try {
      // Start SSE stream for simplification
      const response = await chatApi.simplifyStream(chatId, messageId);

      if (!response.body) {
        throw new Error('No response body for simplify streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            // Determine the event type from the preceding "event:" line
            // SSE format: "event: <type>\ndata: <json>\n\n"
            // We parse by checking the previous accumulated event type
            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(dataStr);
            } catch {
              continue;
            }

            if ('text' in parsed) {
              // token event
              accumulatedContent += parsed.text as string;
              set((state) => ({
                isSimplifyingMessageId: null, // Clear "Simplifying" bubble as soon as streaming starts
                activeChat: state.activeChat?.id === chatId
                  ? {
                    ...state.activeChat,
                    messages: (state.activeChat.messages || []).map((m) =>
                      m.id === simplifyStreamId
                        ? { ...m, content: accumulatedContent }
                        : m,
                    ),
                  }
                  : state.activeChat,
              }));
            } else if ('simplified_text' in parsed) {
              // done event — swap in the final translated text
              const finalText = parsed.simplified_text as string;
              set((state) => ({
                activeChat: state.activeChat?.id === chatId
                  ? {
                    ...state.activeChat,
                    messages: (state.activeChat.messages || []).map((m) =>
                      m.id === simplifyStreamId
                        ? { ...m, content: `[SIMPLIFIED_MARKER]\n\n${finalText}` }
                        : m,
                    ),
                  }
                  : state.activeChat,
              }));
            }
          }
        }
      }

      // Re-fetch the full chat to get real DB IDs and authoritative state
      try {
        const data = await chatApi.get(chatId);
        const normalizedMessages = (data.messages || []).map((m: Record<string, unknown>) => ({
          ...m,
          role: typeof m.role === 'string' ? m.role.toLowerCase() : m.role,
        }));
        set((state) => ({
          activeChat: state.activeChat?.id === chatId
            ? { ...state.activeChat, messages: normalizedMessages }
            : state.activeChat,
        }));
      } catch {
        // Non-critical — the streamed content is already visible
      }
    } catch (error) {
      console.error('Failed to simplify message:', error);
      // Restore original messages on failure
      set((state) => ({
        activeChat: state.activeChat
          ? { ...state.activeChat, messages: activeChat.messages }
          : state.activeChat,
      }));
    } finally {
      set({ isSimplifyingMessageId: null, isStreaming: false, streamingMessageId: null });
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
