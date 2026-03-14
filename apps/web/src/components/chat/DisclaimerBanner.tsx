// ==============================================================================
// PocketJury — DisclaimerBanner Component
// ==============================================================================
'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function DisclaimerBanner() {
  const t = useTranslations('chat');
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDismissed = localStorage.getItem('pocketjury_disclaimer_hidden');
    if (!isDismissed) {
      setVisible(true);
    }
  }, []);

  const handlePermanentDismiss = () => {
    setVisible(false);
    localStorage.setItem('pocketjury_disclaimer_hidden', 'true');
  };

  if (!mounted || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="absolute top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md z-50 shadow-xl rounded-lg border border-amber-200/50 bg-amber-50/95 backdrop-blur-md dark:bg-amber-950/80 dark:border-amber-900/50 p-3 flex items-start gap-3"
        initial={{ opacity: 0, y: -20, x: '-50%' }}
        animate={{ opacity: 1, y: 0, x: '-50%' }}
        exit={{ opacity: 0, y: -20, x: '-50%' }}
      >
        <Shield className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-500 mt-0.5" />

        <div className="flex-1 flex flex-col gap-2">
          <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
            {t('disclaimer')}
          </p>
          <button
            onClick={handlePermanentDismiss}
            className="text-[10px] font-medium text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 self-start transition-colors underline underline-offset-2"
          >
            {t('dontShowAgain')}
          </button>
        </div>

        <button
          className="flex-shrink-0 p-1 rounded-md text-amber-700 hover:bg-amber-200/50 dark:text-amber-400 dark:hover:bg-amber-800/50 transition-colors"
          onClick={() => setVisible(false)}
          title={t('dismissForNow')}
        >
          <X className="h-3 w-3" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
