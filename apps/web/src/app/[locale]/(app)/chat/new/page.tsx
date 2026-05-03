// ==============================================================================
// PocketJury — New Chat Page (/chat/new)
// Shows the welcome UI + suggestions. Creates the chat only when the user sends
// their first message, preventing empty chat records.
// ==============================================================================
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useChatStore } from '@/store';
import { MessageInput } from '@/components/chat/MessageInput';
import { DisclaimerBanner } from '@/components/chat/DisclaimerBanner';
import { Scale } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NewChatPage() {
  const t = useTranslations('chat');
  const router = useRouter();
  const pathname = usePathname();
  const { createChat, sendMessage, fetchChats } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const creatingRef = useRef(false);

  // Clear activeChat so the store knows we're not viewing any chat
  // (important for background stream toast/unread detection)
  useEffect(() => {
    useChatStore.setState({ activeChat: null });
  }, []);

  const handleSend = async (query: string) => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setIsCreating(true);

    try {
      const newChatId = await createChat();
      await fetchChats();

      // Start streaming FIRST so the store sets up activeChat + streaming state
      // before the chatId page's selectChat tries to fetch from server.
      // sendMessage is fire-and-forget — it will keep running in the background.
      sendMessage(newChatId, query).catch(console.error);

      // Navigate to the real chat page — selectChat will detect the active stream
      // and skip the server fetch (preserving the streaming state).
      const locale = pathname.split('/')[1] || 'en';
      router.replace(`/${locale}/chat/${newChatId}`);
    } catch (err) {
      console.error('Failed to create chat:', err);
      creatingRef.current = false;
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <DisclaimerBanner />

      <div className="flex-1 overflow-y-auto px-0 sm:px-4 py-4 sm:py-6 pb-28 sm:pb-32 scrollbar-thin">
        <div className="mx-auto space-y-4 px-[5px] sm:px-10 max-w-[100rem]">
          <motion.div className="text-center py-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Scale className="mx-auto h-16 w-16 text-primary-200 dark:text-blue-900" />
            <h2 className="mt-6 text-xl font-semibold text-heading">{t('welcomeTitle')}</h2>
            <p className="mt-2 text-sm text-muted max-w-md mx-auto">{t('welcomeMessage')}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 max-w-lg mx-auto">
              {(['suggestion1', 'suggestion2', 'suggestion3', 'suggestion4'] as const).map((key) => (
                <button key={key} className="card p-3 text-left text-sm text-body hover:bg-elevated hover:text-heading transition-colors" onClick={() => handleSend(t(key))}>{t(key)}</button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Input */}
      <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 pointer-events-none">
        <div className="mx-auto max-w-3xl pointer-events-auto shadow-2xl rounded-[var(--radius-lg)]">
          <MessageInput onSend={handleSend} disabled={isCreating} isStreaming={false} />
        </div>
      </div>
    </div>
  );
}
