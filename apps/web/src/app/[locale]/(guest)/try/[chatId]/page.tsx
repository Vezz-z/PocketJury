// ==============================================================================
// PocketJury — Guest Chat Page (ephemeral, in-memory only)
// ==============================================================================
'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, ArrowRight, ArrowDown } from 'lucide-react';
import { MessageInput } from '@/components/chat/MessageInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { toast } from 'sonner';

// Align with MessageBubble's expected Message interface
interface GuestMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export default function GuestChatPage({ params }: { params: Promise<{ chatId: string }> }) {
  const { chatId } = use(params);
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const initialized = useRef(false);

  // Load the first message from sessionStorage (set by the try page)
  useEffect(() => {
    if (initialized.current) return;

    const stored = sessionStorage.getItem(`guest-chat-${chatId}`);
    if (stored) {
      initialized.current = true;
      try {
        const { firstMessage } = JSON.parse(stored);
        sessionStorage.removeItem(`guest-chat-${chatId}`);
        if (firstMessage) {
          const userMsg: GuestMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: firstMessage,
            createdAt: new Date().toISOString(),
          };
          setMessages([userMsg]);
          streamResponse(userMsg.content, [userMsg]);
        }
      } catch {
        router.replace(`/${locale}/try`);
      }
    } else {
      router.replace(`/${locale}/try`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, streamingMessageId]);

  // Scroll detection for "jump to bottom" button
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const streamResponse = async (userContent: string, currentMessages: GuestMessage[]) => {
    setIsTyping(true);
    
    // Create an empty assistant message to hold the stream
    const assistantMsgId = crypto.randomUUID();
    setStreamingMessageId(assistantMsgId);
    
    const newAssistantMsg: GuestMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };
    
    setMessages([...currentMessages, newAssistantMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/v1/chats/guest/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userContent,
          languageCode: locale,
          chatHistory: currentMessages.map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch response');
      }

      if (!response.body) throw new Error('No readable stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.token) {
                streamedContent += data.token;
                setMessages(prev => prev.map(m => 
                  m.id === assistantMsgId ? { ...m, content: streamedContent } : m
                ));
              } else if (data.answer || data.answer_translated) {
                // Final full message payload via 'done' event
                streamedContent = data.answer_translated || data.answer;
                setMessages(prev => prev.map(m => 
                  m.id === assistantMsgId ? { ...m, content: streamedContent } : m
                ));
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error(t('guest.streamError') || 'Failed to get response');
        // Remove empty assistant message on error
        setMessages(prev => prev.filter(m => m.id !== assistantMsgId));
      }
    } finally {
      setIsTyping(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  };

  const handleSend = (message: string) => {
    const userMsg: GuestMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    streamResponse(message, newMessages);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsTyping(false);
      setStreamingMessageId(null);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // TypingIndicator component for the loading state before tokens arrive
  const showThinking = isTyping && messages.find(m => m.id === streamingMessageId)?.content === '';

  return (
    <div className="flex flex-1 flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto relative scrollbar-thin px-0 sm:px-4" ref={scrollContainerRef}>
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.map((msg) => {
            // Hide the empty bubble while waiting for first token, show thinking indicator instead
            if (msg.id === streamingMessageId && !msg.content) return null;
            
            return (
              <MessageBubble
                key={msg.id}
                message={msg as any}
                isActivelyStreaming={msg.id === streamingMessageId}
                isGuestMode={true}
                onSimplify={() => {}}
                onFeedback={() => {}}
              />
            );
          })}

          {/* Typing indicator */}
          {showThinking && (
            <div className="flex gap-3 justify-start opacity-70">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-100 dark:bg-blue-900/40 flex items-center justify-center">
                <span className="h-4 w-4 text-primary-700 dark:text-blue-300">⚖️</span>
              </div>
              <div className="bg-elevated rounded-2xl px-4 py-3 h-10 flex items-center">
                <div className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-body/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-body/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-body/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Sign-up CTA after first response */}
          {messages.some((m) => m.role === 'assistant') && !isTyping && (
            <div className="flex justify-center pt-8 pb-4">
              <Link
                href={`/${locale}/register`}
                className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                style={{
                  background: 'var(--color-primary)',
                  color: 'white',
                }}
              >
                <UserPlus className="h-4 w-4" />
                {t('guest.signupCta')} — {t('guest.headerLoginPrompt')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Jump to bottom */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-full shadow-lg bg-card border transition-all hover:shadow-xl"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <ArrowDown className="h-4 w-4 text-body" />
          </button>
        )}
      </div>

      {/* Disclaimer */}
      <div className="px-4 pb-2">
        <div className="disclaimer-banner text-xs max-w-3xl mx-auto justify-center">
          <span>{t('guest.guestDisclaimer')}</span>
        </div>
      </div>

      {/* Message input */}
      <div className="p-4 max-w-3xl mx-auto w-full">
        <MessageInput
          onSend={handleSend}
          disabled={isTyping && !streamingMessageId} // only completely disable if sending hasn't started stream yet
          isStreaming={isTyping}
          onStop={handleStop}
        />
      </div>
    </div>
  );
}
