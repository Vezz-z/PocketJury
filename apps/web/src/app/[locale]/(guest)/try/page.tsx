// ==============================================================================
// PocketJury — Guest Try Page (empty new chat landing)
// ==============================================================================
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Scale, MessageSquare, ArrowRight, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { MessageInput } from '@/components/chat/MessageInput';

export default function GuestTryPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const suggestions = [
    t('chat.suggestion1'),
    t('chat.suggestion2'),
    t('chat.suggestion3'),
    t('chat.suggestion4'),
  ];

  const handleSend = (message: string) => {
    if (isNavigating) return;
    setIsNavigating(true);
    // Generate a temporary chat ID and navigate
    const chatId = crypto.randomUUID();
    // Store the first message in sessionStorage so the chat page can pick it up
    sessionStorage.setItem(`guest-chat-${chatId}`, JSON.stringify({ firstMessage: message }));
    router.push(`/${locale}/try/${chatId}`);
  };

  return (
    <div className="flex flex-1 flex-col h-full">
      {/* Welcome content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full text-center space-y-8">
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-sm"
              style={{ background: 'var(--color-primary-light)' }}
            >
              <Scale className="h-10 w-10 text-primary-600 dark:text-blue-400" />
            </div>
          </div>

          {/* Welcome text */}
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-heading">
              {t('chat.welcomeTitle')}
            </h1>
            <p className="text-body text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
              {t('guest.guestChatWelcome')}
            </p>
          </div>

          {/* Suggestion chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                className="group card p-3 text-left text-sm text-body hover:text-heading hover:shadow-md transition-all duration-200 flex items-start gap-2"
                onClick={() => handleSend(suggestion)}
                disabled={isNavigating}
              >
                <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5 text-primary-600 dark:text-blue-400" />
                <span className="line-clamp-2">{suggestion}</span>
              </button>
            ))}
          </div>

          {/* Signup nudge */}
          <div className="flex justify-center">
            <Link
              href={`/${locale}/register`}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-blue-400 hover:underline transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              {t('guest.headerLoginPrompt')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-4 pb-2">
        <div className="disclaimer-banner text-xs max-w-2xl mx-auto justify-center">
          <span>{t('guest.guestDisclaimer')}</span>
        </div>
      </div>

      {/* Message input */}
      <div className="p-4 max-w-2xl mx-auto w-full">
        <MessageInput
          onSend={handleSend}
          disabled={isNavigating}
        />
      </div>
    </div>
  );
}
