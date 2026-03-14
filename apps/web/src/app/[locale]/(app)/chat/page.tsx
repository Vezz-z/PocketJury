// ==============================================================================
// PocketJury — Chat List / New Chat redirect
// ==============================================================================
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useChatStore } from '@/store';
import { MessageSquarePlus, Clock, ChevronRight, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function ChatPage() {
  const t = useTranslations('chat');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { chats, isLoadingChats, fetchChats, createChat, deleteChat } = useChatStore();

  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const handleNewChat = async () => {
    const chatId = await createChat();
    router.push(`/chat/${chatId}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-heading">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
        </div>
        <button className="btn-primary" onClick={handleNewChat}>
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          {t('newChat')}
        </button>
      </div>

      {isLoadingChats ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-elevated rounded w-1/3" />
              <div className="h-3 bg-elevated rounded w-1/4 mt-2" />
            </div>
          ))}
        </div>
      ) : chats.length === 0 ? (
        <motion.div
          className="text-center py-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <MessageSquarePlus className="mx-auto h-12 w-12 text-muted" />
          <h2 className="mt-4 text-lg font-medium text-heading">{t('noChats')}</h2>
          <p className="mt-2 text-sm text-muted">{t('startFirst')}</p>
          <button className="btn-primary mt-6" onClick={handleNewChat}>
            {t('newChat')}
          </button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {chats.map((chat, i) => (
            <motion.div
              key={chat.id}
              className="card p-4 flex items-center justify-between hover:shadow-md cursor-pointer transition-shadow group"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => router.push(`/chat/${chat.id}`)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-heading truncate">
                  {chat.title || t('untitled')}
                </h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(chat.updatedAt).toLocaleDateString()}
                  </span>
                  <span>
                    {chat.messagesCount} {t('messages')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="p-1.5 rounded-md text-muted hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChatToDelete(chat.id);
                  }}
                  aria-label="Delete chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <ChevronRight className="h-4 w-4 text-muted" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!chatToDelete}
        onClose={() => setChatToDelete(null)}
        onConfirm={() => {
          if (chatToDelete) {
            deleteChat(chatToDelete);
            setChatToDelete(null);
          }
        }}
        title={tCommon('deleteChatTitle')}
        description={tCommon('deleteChatDesc')}
        confirmText={tCommon('delete')}
        cancelText={tCommon('cancel')}
        variant="danger"
        icon="trash"
      />
    </div>
  );
}
