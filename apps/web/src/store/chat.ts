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
  updatedAt: string;
  messages?: Message[];
}

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  isSimplifyingMessageId: string | null;
  error: string | null;

  fetchChats: () => Promise<void>;
  createChat: () => Promise<string>;
  selectChat: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  renameChat: (chatId: string, title: string) => Promise<void>;
  sendMessage: (chatId: string, query: string) => Promise<void>;
  simplifyMessage: (chatId: string, messageId: string) => Promise<void>;
  submitFeedback: (messageId: string, rating: 'HELPFUL' | 'NOT_HELPFUL', comment?: string) => Promise<void>;
  clearError: () => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  chats: [],
  activeChat: null,
  isLoadingChats: false,
  isLoadingMessages: false,
  isSending: false,
  isSimplifyingMessageId: null,
  error: null,

  fetchChats: async () => {
    set({ isLoadingChats: true });
    try {
      const data = await chatApi.list();
      const chatList = Array.isArray(data) ? data : Array.isArray(data?.chats) ? data.chats : Array.isArray(data?.data) ? data.data : [];
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
    set({ isLoadingMessages: true });
    try {
      const data = await chatApi.get(chatId);
      // Normalize message roles: API returns uppercase (USER/ASSISTANT), frontend expects lowercase
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

    set((state) => ({
      isSending: true,
      activeChat: state.activeChat
        ? {
          ...state.activeChat,
          messages: [...(state.activeChat.messages || []), userMessage],
        }
        : state.activeChat,
    }));

    try {
      const data = await chatApi.sendMessage(chatId, query);

      // API returns { userMessage, assistantMessage, disclaimer }
      const serverAssistant = data.assistantMessage || data.message || data;
      const serverUser = data.userMessage;
      const metadata = typeof serverAssistant.metadata === 'object' ? serverAssistant.metadata : {};

      const assistantMessage: Message = {
        id: serverAssistant.id,
        role: 'assistant',
        content: serverAssistant.content,
        references: metadata.citedSections || serverAssistant.references,
        helplines: metadata.helplines || serverAssistant.helplines,
        ipcBnsNote: serverAssistant.ipcBnsNote,
        confidenceScore: metadata.confidenceScore || serverAssistant.confidenceScore,
        processingTimeMs: metadata.processingTimeMs || serverAssistant.processingTimeMs,
        createdAt: serverAssistant.createdAt || new Date().toISOString(),
      };

      // Replace optimistic user message with server version (has real ID)
      const realUserMessage: Message | null = serverUser
        ? { ...userMessage, id: serverUser.id, createdAt: serverUser.createdAt || userMessage.createdAt }
        : null;

      // Auto-rename: use server title, or derive from first user message
      const currentTitle = get().activeChat?.title;
      const isGenericTitle = !currentTitle || currentTitle === 'New Chat' || currentTitle === 'Untitled Chat';
      const serverTitle = data.chatTitle;
      const autoTitle = isGenericTitle && !serverTitle
        ? query.length > 40 ? query.slice(0, 40) + '…' : query
        : null;
      const finalTitle = serverTitle || autoTitle || currentTitle || 'New Chat';

      set((state) => ({
        isSending: false,
        activeChat: state.activeChat
          ? {
            ...state.activeChat,
            title: finalTitle,
            messages: [
              ...(state.activeChat.messages || []).map((m) =>
                m.id === userMessage.id && realUserMessage ? realUserMessage : m,
              ),
              assistantMessage,
            ],
          }
          : state.activeChat,
        chats: state.chats.map((c) =>
          c.id === chatId ? { ...c, title: finalTitle } : c,
        ),
      }));
    } catch (err: any) {
      // Determine specific error based on response
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

      // Persist the error to the database so it's not lost on refresh
      chatApi.createSystemMessage(chatId, errorAssistantMessage.content).catch(console.error);

      set((state) => ({
        isSending: false,
        activeChat: state.activeChat
          ? {
            ...state.activeChat,
            messages: [...(state.activeChat.messages || []), errorAssistantMessage],
          }
          : state.activeChat,
        error: null, // Wipe global error so we don't spam toasts
      }));
    }
  },

  simplifyMessage: async (chatId, messageId) => {
    const currentState = get();
    const activeChat = currentState.activeChat;
    if (!activeChat || !activeChat.messages) return;

    const targetIndex = activeChat.messages.findIndex((m) => m.id === messageId);
    if (targetIndex === -1) return;

    // Cache original to restore if needed
    const originalMessage = activeChat.messages[targetIndex];

    // Optimistically truncate the array (removing the message we are simplifying and all below it)
    const optimisticallyTruncatedMessages = activeChat.messages.slice(0, targetIndex);

    set({
      isSimplifyingMessageId: messageId,
      activeChat: {
        ...activeChat,
        messages: optimisticallyTruncatedMessages,
      }
    });

    try {
      const data = await chatApi.simplify(chatId, messageId);

      set((state) => {
        if (!state.activeChat) return state;

        // Re-append the modified message
        const simplifiedMessage = {
          ...originalMessage,
          content: data.content,
          simplifiedContent: undefined,
        };

        return {
          activeChat: {
            ...state.activeChat,
            messages: [...(state.activeChat.messages || []), simplifiedMessage],
          }
        };
      });
    } catch (error) {
      console.error('Failed to simplify message:', error);
      // Restore the array if API fails
      set((state) => ({
        activeChat: state.activeChat
          ? {
            ...state.activeChat,
            messages: activeChat.messages, // Bring back the untouched slice
          }
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
