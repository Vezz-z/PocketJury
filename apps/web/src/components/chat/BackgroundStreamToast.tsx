// ==============================================================================
// PocketJury — BackgroundStreamToast
// Listens for 'pocketjury:bg-stream-done' events and shows a localized toast.
// ==============================================================================
'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';

export function BackgroundStreamToast() {
  const t = useTranslations('chat');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (e: Event) => {
      const { chatId, chatTitle } = (e as CustomEvent).detail;
      const locale = pathname.split('/')[1] || 'en';

      toast(t('responseReady', { chatTitle }), {
        duration: 12000,
        action: {
          label: t('viewChat'),
          onClick: () => router.push(`/${locale}/chat/${chatId}`),
        },
        classNames: {
          actionButton: '!bg-transparent !text-[#001f5c] dark:!text-blue-300 !underline !shadow-none !p-0 !font-medium',
        },
      });
    };

    window.addEventListener('pocketjury:bg-stream-done', handler);
    return () => window.removeEventListener('pocketjury:bg-stream-done', handler);
  }, [t, router, pathname]);

  return null;
}
