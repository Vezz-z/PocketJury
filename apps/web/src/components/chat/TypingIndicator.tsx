// ==============================================================================
// PocketJury — TypingIndicator Component
// ==============================================================================
'use client';

import { useTranslations } from 'next-intl';
import { Scale } from 'lucide-react';
import { motion } from 'framer-motion';

export function TypingIndicator({ text }: { text?: string }) {
  const t = useTranslations('chat');

  return (
    <motion.div
      className="flex gap-3"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 dark:bg-blue-900/40 flex items-center justify-center">
        <Scale className="h-4 w-4 text-primary-700 dark:text-blue-300" />
      </div>
      <div className="chat-bubble-assistant">
        <div className="typing-indicator">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
        <span className="text-xs text-muted mt-1 block">
          {text || t('thinking')}
        </span>
      </div>
    </motion.div>
  );
}
