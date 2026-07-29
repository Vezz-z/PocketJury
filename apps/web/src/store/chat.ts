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

  isGuestMode: boolean;

  fetchChats: () => Promise<void>;
  createChat: () => Promise<string>;
  createGuestChat: () => string;
  selectChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  renameChat: (chatId: string, title: string) => Promise<void>;
  clearGuestChat: () => void;
  sendMessage: (chatId: string, query: string) => Promise<void>;
  stopStreaming: (chatId?: string) => void;
  simplifyMessage: (chatId: string, messageId: string) => Promise<void>;
  submitFeedback: (messageId: string, rating: 'HELPFUL' | 'NOT_HELPFUL', comment?: string) => Promise<void>;
  clearError: () => void;
}

// Module-level refs for concurrent stream management
const _activeReaders = new Map<string, ReadableStreamDefaultReader<Uint8Array>>();
const _chatStreamingMsgIds = new Map<string, string>(); // chatId -> streamingAssistantId

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

// Helper to save active chat to background streams if currently streaming
const preserveActiveStream = (state: ChatState) => {
  const active = state.activeChat;
  if (!active) return;
  if (state.isStreaming || state.streamingChatIds.includes(active.id)) {
    const streamMsgId = _chatStreamingMsgIds.get(active.id) || state.streamingMessageId || '';
    _backgroundStreams.set(active.id, {
      messages: active.messages || [],
      streamingMessageId: streamMsgId,
    });
  }
};

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
  isGuestMode: false,

  fetchChats: async () => {
    // Guest mode has no persisted chats — skip the API call entirely
    if (get().isGuestMode) {
      set({ chats: [], isLoadingChats: false });
      return;
    }
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

  createGuestChat: () => {
    preserveActiveStream(get());
    const tempId = `guest-${Date.now()}`;
    const newChat: Chat = {
      id: tempId,
      title: 'Temporary Chat',
      messagesCount: 0,
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    set((state) => ({
      isGuestMode: true,
      activeChat: newChat,
      chats: [newChat, ...state.chats.filter((c) => c.id !== tempId)],
      isSending: false,
      isStreaming: false,
      streamingMessageId: null,
    }));
    return tempId;
  },

  clearGuestChat: () => {
    _backgroundStreams.clear();
    _streamContent.clear();
    _completedStreamMeta.clear();
    _chatStreamingMsgIds.clear();
    _activeReaders.clear();
    set({
      isGuestMode: false,
      activeChat: null,
      chats: [],
      isSending: false,
      isStreaming: false,
      streamingMessageId: null,
      streamingChatIds: [],
    });
  },

  createChat: async () => {
    preserveActiveStream(get());
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
      isSending: false,
      isStreaming: false,
      streamingMessageId: null,
    }));
    return data.id;
  },

  selectChat: async (chatId) => {
    const prev = get();
    if (prev.activeChat?.id === chatId && prev.activeChat) {
      set((state) => ({
        chats: state.chats.map((c) => (c.id === chatId ? { ...c, hasUnread: false } : c)),
      }));
      return;
    }

    // Preserve the currently active stream before switching away
    preserveActiveStream(prev);

    // Clear hasUnread for the target chat
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, hasUnread: false } : c)),
      isSending: false,
      isStreaming: false,
      streamingMessageId: null,
    }));

    // If the target chat is actively reading SSE tokens in the background, restore UI
    if (_activeReaders.has(chatId) && !_backgroundStreams.has(chatId)) {
      const currentStreamMsgId = _chatStreamingMsgIds.get(chatId) || null;
      set({
        isLoadingMessages: false,
        isSending: true,
        isStreaming: true,
        streamingMessageId: currentStreamMsgId,
      });
      return;
    }

    // Check if we have a background stream snapshot for this chat
    const bg = _backgroundStreams.get(chatId);
    if (bg) {
      const latestContent = _streamContent.get(bg.streamingMessageId) || '';
      const restoredMessages = bg.messages.map((m) =>
        m.id === bg.streamingMessageId ? { ...m, content: latestContent || m.content } : m,
      );

      const isStillStreaming = get().streamingChatIds.includes(chatId);

      const existingChat = prev.chats.find((c) => c.id === chatId);
      const chat: Chat = {
        id: chatId,
        title: existingChat?.title || prev.activeChat?.title || 'New Chat',
        messagesCount: restoredMessages.length,
        updatedAt: new Date().toISOString(),
        messages: restoredMessages,
      };

      set({
        activeChat: chat,
        isLoadingMessages: false,
        isSending: isStillStreaming,
        isStreaming: isStillStreaming,
        streamingMessageId: isStillStreaming ? bg.streamingMessageId : null,
      });
      return;
    }

    // In Guest Mode, restore chat from state.chats
    if (get().isGuestMode) {
      const guestChat = get().chats.find((c) => c.id === chatId);
      if (guestChat) {
        set({
          activeChat: guestChat,
          isLoadingMessages: false,
          isSending: false,
          isStreaming: false,
          streamingMessageId: null,
        });
      } else {
        set({ isLoadingMessages: false });
      }
      return;
    }

    // Normal fetch from server
    if (get().isGuestMode) {
      set({ isLoadingMessages: false });
      return;
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

    if (get().isGuestMode || chatId.startsWith('guest-')) return;

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

    if (get().isGuestMode || chatId.startsWith('guest-')) return;

    try {
      await chatApi.update(chatId, { title });
    } catch {
      set({ chats: previousChats, error: 'Failed to rename chat' });
    }
  },

  sendMessage: async (chatId, query) => {
    const isGuest = get().isGuestMode;
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

    // Mark this chat as having an active stream BEFORE the API call
    _chatStreamingMsgIds.set(chatId, streamingAssistantId);

    // Add user message to activeChat — create activeChat if it doesn't exist
    set((state) => {
      const existing = state.activeChat?.id === chatId ? state.activeChat : null;
      const derivedTitle = isGuest && (!existing?.title || existing.title === 'Temporary Chat')
        ? (query.length > 30 ? query.slice(0, 27) + '...' : query)
        : (existing?.title || 'New Chat');

      const chat: Chat = existing
        ? { ...existing, title: derivedTitle, messages: [...(existing.messages || []), userMessage] }
        : { id: chatId, title: derivedTitle, messagesCount: 1, updatedAt: new Date().toISOString(), messages: [userMessage] };

      return {
        isSending: true,
        isStreaming: false,
        activeChat: chat,
        chats: state.chats.some((c) => c.id === chatId)
          ? state.chats.map((c) => (c.id === chatId ? { ...c, title: derivedTitle, messages: chat.messages } : c))
          : [chat, ...state.chats],
      };
    });

    // Start title polling immediately for first messages
    if (isGenericTitle && !isGuest) {
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
      // Build history for guest mode if necessary
      const history = isGuest
        ? (get().activeChat?.messages || [])
            .filter((m) => m.id !== userMessage.id && m.id !== streamingAssistantId)
            .map((m) => ({ role: m.role, content: m.content }))
        : [];

      // Make API request (timeout 180s)
      const response = isGuest
        ? await chatApi.guestSendMessageStream(query, 'en', history)
        : await chatApi.sendMessageStream(chatId, query);

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      _streamContent.set(streamingAssistantId, '');

      // Add the empty assistant message placeholder
      set((state) => {
        const isOnThisChat = state.activeChat?.id === chatId;
        const updatedActive = isOnThisChat && state.activeChat
          ? {
              ...state.activeChat,
              messages: [...(state.activeChat.messages || []), streamingAssistant],
            }
          : state.activeChat;

        return {
          isStreaming: isOnThisChat ? true : state.isStreaming,
          streamingMessageId: isOnThisChat ? streamingAssistantId : state.streamingMessageId,
          streamingChatIds: state.streamingChatIds.includes(chatId)
            ? state.streamingChatIds
            : [...state.streamingChatIds, chatId],
          activeChat: updatedActive,
          chats: state.chats.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: [...(c.messages || []), streamingAssistant],
                }
              : c
          ),
        };
      });

      // Parse SSE stream with per-chat reader tracking
      const reader = response.body.getReader();
      _activeReaders.set(chatId, reader);
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
          buffer = events.pop() || '';

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
              case 'title':
                const newTitle = parsed.title as string;
                if (newTitle) {
                  set((state) => ({
                    activeChat: state.activeChat?.id === chatId
                      ? { ...state.activeChat, title: newTitle }
                      : state.activeChat,
                    chats: state.chats.map((c) =>
                      c.id === chatId ? { ...c, title: newTitle } : c,
                    ),
                  }));
                }
                break;

              case 'metadata':
                metadata = parsed;
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
                _streamContent.set(streamingAssistantId, accumulatedContent);

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

                // Update background stream entry if present
                const bgTokenEntry = _backgroundStreams.get(chatId);
                if (bgTokenEntry) {
                  bgTokenEntry.messages = bgTokenEntry.messages.map((m) =>
                    m.id === streamingAssistantId ? { ...m, content: accumulatedContent } : m,
                  );
                }

                // Update chats array in store (for guest mode & sidebar)
                if (get().isGuestMode) {
                  set((state) => ({
                    chats: state.chats.map((c) =>
                      c.id === chatId
                        ? {
                          ...c,
                          messages: (c.messages || []).map((m) =>
                            m.id === streamingAssistantId ? { ...m, content: accumulatedContent } : m,
                          ),
                        }
                        : c
                    ),
                  }));
                }
                break;

              case 'done': {
                const finalContent = accumulatedContent || (parsed.answer_translated as string) || (parsed.answer as string) || '';
                const ptMs = parsed.processing_time_ms as number | undefined;

                const finalAssistantMessage: Message = {
                  id: streamingAssistantId,
                  role: 'assistant',
                  content: finalContent,
                  createdAt: new Date().toISOString(),
                  processingTimeMs: ptMs,
                  references: (metadata.references as Message['references']) || undefined,
                  helplines: (metadata.helplines as Message['helplines']) || undefined,
                  ipcBnsNote: (metadata.ipc_bns_note as string) || undefined,
                  confidenceScore: (metadata.confidence_score as number) || undefined,
                };

                // Update background stream entry if present
                const bgDoneEntry = _backgroundStreams.get(chatId);
                if (bgDoneEntry) {
                  bgDoneEntry.messages = bgDoneEntry.messages.map((m) =>
                    m.id === streamingAssistantId ? finalAssistantMessage : m,
                  );
                }

                // Always update state.chats with the final message
                set((state) => ({
                  chats: state.chats.map((c) => {
                    if (c.id === chatId) {
                      const msgs = c.messages || [];
                      const exists = msgs.some((m) => m.id === streamingAssistantId);
                      const updatedMsgs = exists
                        ? msgs.map((m) => (m.id === streamingAssistantId ? finalAssistantMessage : m))
                        : [...msgs, finalAssistantMessage];
                      return {
                        ...c,
                        messages: updatedMsgs,
                        messagesCount: updatedMsgs.length,
                        lastMessage: finalContent.slice(0, 100),
                        updatedAt: new Date().toISOString(),
                      };
                    }
                    return c;
                  }),
                }));

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
                          m.id === streamingAssistantId ? finalAssistantMessage : m,
                        ),
                      }
                      : state.activeChat,
                  }));
                } else {
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
        if (readErr?.message?.includes('cancel') || readErr?.name === 'AbortError') {
          wasCancelled = true;
        } else {
          throw readErr;
        }
      } finally {
        _activeReaders.delete(chatId);
        _chatStreamingMsgIds.delete(chatId);
      }

      // If cancelled by user, keep accumulated content as the final message
      if (wasCancelled) {
        _streamContent.delete(streamingAssistantId);
        _backgroundStreams.delete(chatId);
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

      const isStillOnThisChat = get().activeChat?.id === chatId;
      if (isStillOnThisChat) {
        set((state) => ({ isSending: false, isStreaming: false, streamingMessageId: null, streamingChatIds: state.streamingChatIds.filter((id) => id !== chatId) }));

        if (!isGuest) {
          try {
            const data = await chatApi.get(chatId);
            const serverMessages = (data.messages || []).map((m: Record<string, unknown>) => ({
              ...m,
              role: typeof m.role === 'string' ? m.role.toLowerCase() : m.role,
            }));

            const currentMessages = get().activeChat?.messages || [];
            const mergedMessages = serverMessages.map((sm: Message, idx: number) => {
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
            // Non-critical
          }
        }
      } else {
        set((state) => ({
          streamingChatIds: state.streamingChatIds.filter((id) => id !== chatId),
          chats: state.chats.map((c) => c.id === chatId ? { ...c, hasUnread: true } : c),
        }));
        if (typeof window !== 'undefined') {
          const chatTitle = get().chats.find((c) => c.id === chatId)?.title || 'Chat';
          window.dispatchEvent(new CustomEvent('pocketjury:bg-stream-done', {
            detail: { chatId, chatTitle },
          }));
        }
      }

    } catch (err: any) {
      _streamContent.delete(streamingAssistantId);
      _backgroundStreams.delete(chatId);
      _chatStreamingMsgIds.delete(chatId);
      _activeReaders.delete(chatId);

      set((state) => ({
        streamingChatIds: state.streamingChatIds.filter((id) => id !== chatId),
      }));

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

      if (!isGuest && !chatId.startsWith('guest-')) {
        chatApi.createSystemMessage(chatId, errorAssistantMessage.content).catch(console.error);
      }

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

  stopStreaming: (chatId?: string) => {
    const targetChatId = chatId || get().activeChat?.id;
    if (targetChatId) {
      const reader = _activeReaders.get(targetChatId);
      if (reader) {
        reader.cancel().catch(() => {});
        _activeReaders.delete(targetChatId);
      }
      _chatStreamingMsgIds.delete(targetChatId);
    }
    const currentChatId = get().activeChat?.id;
    set((state) => ({
      isSending: targetChatId === currentChatId ? false : state.isSending,
      isStreaming: targetChatId === currentChatId ? false : state.isStreaming,
      streamingMessageId: targetChatId === currentChatId ? null : state.streamingMessageId,
      streamingChatIds: targetChatId
        ? state.streamingChatIds.filter((id) => id !== targetChatId)
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

      // Re-fetch the full chat to get real DB IDs and authoritative state (authenticated users only)
      if (!get().isGuestMode && !chatId.startsWith('guest-')) {
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
    if (get().isGuestMode || messageId.startsWith('temp-') || messageId.startsWith('error-')) {
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
      return;
    }

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
