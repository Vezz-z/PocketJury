// ==============================================================================
// PocketJury — Individual Chat Conversation Page
// ==============================================================================
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useChatStore } from '@/store';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { DisclaimerBanner } from '@/components/chat/DisclaimerBanner';
import { Scale, MoreVertical, Pencil, X, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { chatApi } from '@/lib/api';
import { toast } from 'sonner';

export default function ChatConversationPage() {
  const t = useTranslations('chat');
  const { chatId } = useParams<{ chatId: string }>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    activeChat,
    isLoadingMessages,
    isSending,
    isSimplifyingMessageId,
    selectChat,
    sendMessage,
    simplifyMessage,
    submitFeedback,
  } = useChatStore();

  useEffect(() => {
    if (chatId) selectChat(chatId);
  }, [chatId, selectChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages?.length, isSending]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSend = async (query: string) => {
    if (!chatId) return;
    await sendMessage(chatId, query);
  };

  const handleRename = async () => {
    if (!chatId || !renameValue.trim()) return;
    try {
      await chatApi.update(chatId, { title: renameValue.trim() });
      // Update local state
      useChatStore.setState((state) => ({
        activeChat: state.activeChat
          ? { ...state.activeChat, title: renameValue.trim() }
          : state.activeChat,
        chats: state.chats.map((c) =>
          c.id === chatId ? { ...c, title: renameValue.trim() } : c,
        ),
      }));
      setIsRenaming(false);
      toast.success(t('chatRenamed'));
    } catch {
      toast.error(t('renameError'));
    }
  };

  if (isLoadingMessages) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  const messages = activeChat?.messages || [];

  return (
    <div className="flex flex-col h-full relative">
      {/* Chat header with title and three-dot menu */}
      {activeChat && (
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isRenaming ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  className="input text-sm py-1 flex-1"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') setIsRenaming(false);
                  }}
                  autoFocus
                />
                <button className="p-1 rounded text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={handleRename}>
                  <Check className="h-4 w-4" />
                </button>
                <button className="p-1 rounded text-muted hover:bg-elevated" onClick={() => setIsRenaming(false)}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <h2 className="text-sm font-medium text-heading truncate">
                {activeChat.title || t('untitled')}
              </h2>
            )}
          </div>
          {!isRenaming && (
            <div className="relative" ref={menuRef}>
              <button
                className="p-1.5 rounded-md text-muted hover:bg-elevated transition-colors"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Chat options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-40 rounded-lg shadow-lg border overflow-hidden z-50"
                  style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                >
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-body hover:bg-elevated transition-colors flex items-center gap-2"
                    onClick={() => {
                      setRenameValue(activeChat.title || '');
                      setIsRenaming(true);
                      setMenuOpen(false);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t('rename')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <DisclaimerBanner />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-0 sm:px-4 py-4 sm:py-6 pb-48 sm:pb-56 scrollbar-thin">
        <div className="mx-auto space-y-4 px-[5px] sm:px-10 max-w-[100rem]">
          {messages.length === 0 && (
            <motion.div
              className="text-center py-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Scale className="mx-auto h-16 w-16 text-primary-200 dark:text-blue-900" />
              <h2 className="mt-6 text-xl font-semibold text-heading">
                {t('welcomeTitle')}
              </h2>
              <p className="mt-2 text-sm text-muted max-w-md mx-auto">
                {t('welcomeMessage')}
              </p>

              {/* Suggested questions */}
              <div className="mt-8 grid gap-3 sm:grid-cols-2 max-w-lg mx-auto">
                {(['suggestion1', 'suggestion2', 'suggestion3', 'suggestion4'] as const).map(
                  (key) => (
                    <button
                      key={key}
                      className="card p-3 text-left text-sm text-body hover:bg-elevated hover:text-heading transition-colors"
                      onClick={() => handleSend(t(key))}
                    >
                      {t(key)}
                    </button>
                  ),
                )}
              </div>
            </motion.div>
          )}

          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSimplify={() => simplifyMessage(chatId, msg.id)}
              onFeedback={(rating) => submitFeedback(msg.id, rating)}
            />
          ))}

          {isSending && <TypingIndicator />}
          {isSimplifyingMessageId && <TypingIndicator text={t('simplifying')} />}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 pointer-events-none">
        <div className="mx-auto max-w-3xl pointer-events-auto shadow-2xl rounded-[var(--radius-lg)]">
          <MessageInput onSend={handleSend} disabled={isSending} />
        </div>
      </div>
    </div>
  );
}
