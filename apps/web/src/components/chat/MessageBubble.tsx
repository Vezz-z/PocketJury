// ==============================================================================
// PocketJury — MessageBubble Component
// ==============================================================================
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import {
  ThumbsUp,
  ThumbsDown,
  BookOpen,
  Sparkles,
  Phone,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  User,
  Scale,
} from 'lucide-react';
import { toast } from 'sonner';

interface Reference {
  documentId: string;
  title: string;
  documentType: string;
  section?: string;
  relevanceScore: number;
  excerpt: string;
}

interface HelplineInfo {
  name: string;
  phone: string;
  description: string;
  category: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  references?: Reference[];
  helplines?: HelplineInfo[];
  ipcBnsNote?: string;
  confidenceScore?: number;
  processingTimeMs?: number;
  simplifiedContent?: string;
  feedbackRating?: 'HELPFUL' | 'NOT_HELPFUL';
  createdAt: string;
}

interface MessageBubbleProps {
  message: Message;
  isActivelyStreaming?: boolean;
  isGuestMode?: boolean;
  onSimplify: () => void | Promise<void>;
  onFeedback: (rating: 'HELPFUL' | 'NOT_HELPFUL') => void;
}

export function MessageBubble({ message, isActivelyStreaming, isGuestMode, onSimplify, onFeedback }: MessageBubbleProps) {
  const t = useTranslations('chat');
  const isUser = message.role === 'user';
  const isError = !isUser && message.content.startsWith('⚠️');
  const [showRefs, setShowRefs] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t('copied'));
  };

  return (
    <motion.div
      className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 dark:bg-blue-900/40 flex items-center justify-center">
          <Scale className="h-4 w-4 text-primary-700 dark:text-blue-300" />
        </div>
      )}

      <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? 'order-first' : ''}`}>
        {/* Bubble */}
        <div className={isUser ? 'chat-bubble-user overflow-hidden text-[14px] sm:text-base leading-relaxed' : 'chat-bubble-assistant overflow-hidden text-[14px] sm:text-base leading-relaxed'}>
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="markdown-content">
              {/* Check if message has the simplified marker injected by backend, or the old hardcoded legacy emoji string from cached queries */}
              {(message.content.includes('[SIMPLIFIED_MARKER]') || message.content.includes('**✨ Simplified**')) && (
                <div className="flex items-center gap-1.5 text-secondary-600 dark:text-green-400 mb-2 italic font-normal text-[0.9em]">
                  <Sparkles className="h-4 w-4" />
                  {t('simplified')}
                </div>
              )}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({ node, ...props }) => <div className="overflow-x-auto my-4 border rounded-lg border-border"><table className="w-full text-left border-collapse" {...props} /></div>,
                  th: ({ node, ...props }) => <th className="bg-elevated px-4 py-2 border-b font-medium text-heading" {...props} />,
                  td: ({ node, ...props }) => <td className="px-4 py-2 border-b border-border/50 text-body" {...props} />,
                }}
              >
                {message.content
                  .replace('[SIMPLIFIED_MARKER]\n\n', '').replace('[SIMPLIFIED_MARKER]', '')
                  .replace('**✨ Simplified**\n\n', '').replace('**✨ Simplified**', '')
                  /* Sanitize raw HTML tags the LLM may inject */
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<\/?(div|span|p|b|i|u|em|strong|a|img|script|style|iframe|input|form|button|select|textarea|link|meta|object|embed)[^>]*>/gi, '')
                }
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* IPC-BNS Note */}
        {message.ipcBnsNote && (
          <div className="mt-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 text-xs text-amber-800 dark:text-amber-200">
            <div className="flex items-center gap-1 font-medium mb-1">
              <AlertTriangle className="h-3 w-3" />
              {t('ipcBnsNote')}
            </div>
            <p>{message.ipcBnsNote}</p>
          </div>
        )}

        {/* Helplines */}
        {message.helplines && message.helplines.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.helplines.map((h, i) => (
              <div key={i} className="helpline-card">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-heading">{h.name}</span>
                    <p className="text-xs text-muted">{h.description}</p>
                  </div>
                  <a
                    href={`tel:${h.phone}`}
                    className="flex items-center gap-1 text-sm font-bold text-accent-600 dark:text-orange-400"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {h.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* References */}
        {!isUser && message.references && message.references.length > 0 && (
          <div className="mt-2">
            <button
              className="flex items-center gap-1 text-xs text-primary-600 dark:text-blue-400 hover:opacity-80"
              onClick={() => setShowRefs(!showRefs)}
            >
              <BookOpen className="h-3 w-3" />
              {t('sources')} ({message.references.length})
              {showRefs ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {showRefs && (
              <motion.div
                className="mt-2 space-y-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
              >
                {message.references.map((ref, i) => (
                  <div key={i} className="source-ref">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-heading">{ref.title}</span>
                      <span className="badge badge-primary text-[10px]">
                        {(ref.relevanceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    {ref.section && (
                      <span className="text-[10px] text-muted">{ref.section}</span>
                    )}
                    <p className="text-xs text-body mt-1 line-clamp-2">{ref.excerpt}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}

        {/* Actions toolbar for assistant messages — hidden during streaming, error messages, and in guest mode */}
        {!isUser && !isActivelyStreaming && !isError && message.content && !isGuestMode && (
          <div className="mt-2 flex items-center gap-1">
            {/* Copy */}
            <button
              className="p-1 rounded text-muted hover:text-heading hover:bg-elevated"
              onClick={handleCopy}
              title={t('copy')}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-secondary-500 dark:text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>

            {/* Simplify */}
            <button
              className="p-1 rounded text-muted hover:text-heading hover:bg-elevated"
              onClick={async () => {
                await onSimplify();
              }}
              title={t('simplify')}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>

            {/* Feedback */}
            <div className="flex items-center gap-0.5 ml-2">
              <button
                className={`p-1 rounded transition-colors ${message.feedbackRating === 'HELPFUL'
                  ? 'text-secondary-600 dark:text-green-400 bg-secondary-50 dark:bg-green-900/30'
                  : 'text-muted hover:text-heading hover:bg-elevated'
                  }`}
                onClick={() => onFeedback('HELPFUL')}
                title={t('helpful')}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                className={`p-1 rounded transition-colors ${message.feedbackRating === 'NOT_HELPFUL'
                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
                  : 'text-muted hover:text-heading hover:bg-elevated'
                  }`}
                onClick={() => onFeedback('NOT_HELPFUL')}
                title={t('notHelpful')}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Confidence & processing time */}
            {message.confidenceScore !== undefined && (
              <span className="ml-auto text-[10px] text-muted">
                {(message.confidenceScore * 100).toFixed(0)}% · {message.processingTimeMs}ms
              </span>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-elevated flex items-center justify-center">
          <User className="h-4 w-4 text-body" />
        </div>
      )}
    </motion.div>
  );
}
