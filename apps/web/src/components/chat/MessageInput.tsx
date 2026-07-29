// ==============================================================================
// PocketJury — MessageInput Component
// ==============================================================================
'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2, Square } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

export function MessageInput({ onSend, onStop, disabled, isStreaming }: MessageInputProps) {
  const t = useTranslations('chat');
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          className="input resize-none min-h-[44px] max-h-[160px] py-2.5 pr-12"
          placeholder={t('inputPlaceholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
      </div>
      {isStreaming ? (
        <button
          className="h-[44px] w-[44px] flex items-center justify-center p-0 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
          onClick={onStop}
          aria-label={t('stopGenerating')}
          title={t('stopGenerating')}
        >
          <Square className="h-4 w-4 fill-current" />
        </button>
      ) : (
        <button
          className="btn-primary h-[44px] w-[44px] flex items-center justify-center p-0"
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          aria-label={t('send')}
        >
          {disabled ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      )}
    </div>
  );
}
