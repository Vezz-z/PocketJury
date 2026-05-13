// ==============================================================================
// PocketJury — Sidebar Component
// ==============================================================================
'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useChatStore, useUIStore, useAuthStore } from '@/store';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  MessageSquare,
  MessageSquarePlus,
  Settings,
  Phone,
  X,
  Menu,
  Trash2,
  Scale,
  MoreVertical,
  Pencil,
  Check,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SidebarProps {
  open: boolean;
  desktopOpen: boolean;
  onClose: () => void;
}

function ChatItem({
  chat,
  isActive,
  isStreaming,
  hasUnread,
  onSelect,
  onDelete,
  onRename,
}: {
  chat: { id: string; title: string };
  isActive: boolean;
  isStreaming?: boolean;
  hasUnread?: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const t = useTranslations('nav');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(chat.title || '');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commitRename = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== chat.title) onRename(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5">
        <input
          ref={inputRef}
          className="flex-1 text-sm rounded px-2 py-1 border bg-card text-heading"
          style={{ borderColor: 'var(--color-border)' }}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={commitRename}
        />
        <button onClick={commitRename} className="p-0.5 rounded text-primary-600 hover:bg-elevated">
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors w-full ${isActive
        ? 'bg-[var(--color-primary-light)] text-primary-700 dark:text-blue-400'
        : 'text-body hover:bg-elevated'
        }`}
      onClick={onSelect}
      title={chat.title || t('untitledChat')}
    >
      {/* Chat icon — pulsating when streaming, solid otherwise */}
      {isStreaming ? (
        <span className="relative flex h-4 w-4 flex-shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-3.5 w-3.5 rounded-full border-2 border-primary-500 dark:border-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-600 dark:bg-blue-400 animate-ping" />
        </span>
      ) : (
        <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" style={{ fill: 'currentColor' }} />
      )}
      <span className="truncate flex-1 min-w-0">{chat.title || t('untitledChat')}</span>

      {/* Blue unread dot */}
      {hasUnread && (
        <span className="h-2 w-2 rounded-full bg-primary-600 dark:bg-blue-400 flex-shrink-0" />
      )}

      {/* Three-dot menu */}
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          className="p-0.5 rounded text-muted hover:text-heading opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-32 rounded-lg shadow-lg border overflow-hidden z-50"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <button
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-body hover:bg-elevated transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                setEditTitle(chat.title || '');
                setEditing(true);
              }}
            >
              <Pencil className="h-3 w-3" /> {t('rename')}
            </button>
            <button
              className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-red-500 dark:text-red-400 hover:bg-elevated transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" /> {t('delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ open, desktopOpen, onClose }: SidebarProps) {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const pathname = usePathname();
  const { chats, fetchChats, deleteChat, renameChat, streamingChatIds } = useChatStore();
  const { isAuthenticated } = useAuthStore();

  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Navigate to /chat/new instead of creating a chat
  const handleNewChat = () => {
    const locale = pathname.split('/')[1] || 'en';
    router.push(`/${locale}/chat/new`);
    onClose();
  };

  // Keyboard shortcuts: Ctrl+Shift+K (new chat), Ctrl+Alt+K (toggle sidebar), Ctrl+Shift+S (settings), Ctrl+Alt+C (chats)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (e.ctrlKey && e.shiftKey && key === 'k') {
        e.preventDefault();
        handleNewChat();
      } else if (e.ctrlKey && e.altKey && key === 'k') {
        e.preventDefault();
        useUIStore.getState().toggleDesktopSidebar();
      } else if (e.ctrlKey && e.shiftKey && key === 's') {
        e.preventDefault();
        const locale = pathname.split('/')[1] || 'en';
        router.push(`/${locale}/settings`);
      } else if (e.ctrlKey && e.altKey && key === 'c') {
        e.preventDefault();
        const locale = pathname.split('/')[1] || 'en';
        router.push(`/${locale}/chat`);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const navItems = [
    ...(isAuthenticated ? [{ href: '/chat', icon: MessageSquare, label: t('chat'), shortcut: 'Ctrl+Alt+C' }] : []),
    { href: '/dlsa', icon: Phone, label: t('dlsa'), shortcut: '' },
    ...(isAuthenticated ? [{ href: '/settings', icon: Settings, label: t('settings'), shortcut: 'Ctrl+Shift+S' }] : []),
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-card border-r w-full overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)', padding: '.85rem' }}>
        <div className="flex items-center gap-2">
          {/* Desktop sidebar toggle (inside panel) */}
          <button
            className="p-1 rounded-md text-body hover:bg-elevated hidden md:flex transition-colors mr-1"
            onClick={() => useUIStore.getState().toggleDesktopSidebar()}
            aria-label={t('toggleSidebar')}
            title={`${t('toggleSidebar')} (Ctrl+Alt+K)`}
          >
            <Menu className="h-5 w-5" />
          </button>
          <Scale className="h-5 w-5 text-primary-600 dark:text-blue-400" />
          <span className="font-bold text-heading">PocketJury</span>
        </div>
        <button
          className="p-1 rounded-md text-muted hover:bg-elevated md:hidden transition-colors"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* New Chat */}
      {isAuthenticated && (
        <div className="p-3">
          <button className="btn-primary w-full text-sm" onClick={handleNewChat} title={`${t('newChat')} (Ctrl+Shift+K)`}>
            <MessageSquarePlus className="h-4 w-4 mr-2" />
            {t('newChat')}
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className="px-3 mt-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.includes(item.href);
          return (
            <button
              key={item.href}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                ? 'bg-[var(--color-primary-light)] text-primary-700 dark:text-blue-400 font-medium'
                : 'text-body hover:bg-elevated'
                }`}
              onClick={() => {
                router.push(item.href);
                onClose();
              }}
              title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Chat History / Guest CTA */}
      <div className="flex-1 overflow-y-auto mt-4 px-3 scrollbar-thin flex flex-col">
        {isAuthenticated ? (
          <>
            <p className="text-xs font-medium text-muted uppercase tracking-wider px-3 mb-2">
              {t('recentChats')}
            </p>
            <div className="space-y-0.5">
              {Array.isArray(chats) && chats.slice(0, 20).map((chat) => (
                <ChatItem
                  key={chat.id}
                  chat={chat}
                  isActive={pathname.includes(chat.id)}
                  isStreaming={streamingChatIds.includes(chat.id)}
                  hasUnread={chat.hasUnread}
                  onSelect={() => {
                    router.push(`/chat/${chat.id}`);
                    onClose();
                  }}
                  onDelete={() => setChatToDelete(chat.id)}
                  onRename={(title) => renameChat(chat.id, title)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="mt-8 mx-2 p-4 rounded-xl border border-[var(--color-border)] bg-card text-center shadow-sm">
            <h3 className="text-sm font-semibold text-heading mb-2">{t('loginToSave')}</h3>
            <p className="text-xs text-muted mb-4">{t('loginToSaveDesc')}</p>
            <div className="flex flex-col gap-2">
              <Link href={`/${pathname.split('/')[1] || 'en'}/register`} className="btn-primary py-2 text-xs w-full">
                {t('getStarted')}
              </Link>
              <Link href={`/${pathname.split('/')[1] || 'en'}/login`} className="btn-outline py-2 text-xs w-full">
                {t('login')}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar Footer Links */}
      <div className="p-4 border-t flex flex-wrap justify-center gap-x-4 gap-y-2 text-[10px] text-muted bg-card/50" style={{ borderColor: 'var(--color-border)' }}>
        <Link href={`/${pathname.split('/')[1]}/terms`} target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 dark:hover:text-blue-400 transition-colors">
          {tAuth('termsLink')}
        </Link>
        <Link href={`/${pathname.split('/')[1]}/privacy`} target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 dark:hover:text-blue-400 transition-colors">
          {tAuth('privacyLink')}
        </Link>
        <Link href={`/${pathname.split('/')[1]}/legal-sources`} target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 dark:hover:text-blue-400 transition-colors">
          {tAuth('legalSourcesLink')}
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — collapsible with smooth animation */}
      <motion.div
        className="hidden md:flex md:flex-shrink-0 relative overflow-hidden"
        initial={false}
        animate={{
          width: desktopOpen ? '11.4rem' : '0rem',
          opacity: desktopOpen ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        style={{ minWidth: 0 }}
      >
        <div style={{ minWidth: '11.4rem', maxWidth: '11.4rem', width: '11.4rem' }}>
          {sidebarContent}
        </div>
      </motion.div>

      {/* Desktop collapse button when closed */}
      {!desktopOpen && (
        <button
          className="hidden md:flex absolute top-3 left-4 z-50 p-1.5 rounded-md text-body hover:bg-elevated transition-colors bg-card border shadow-sm"
          style={{ borderColor: 'var(--color-border)' }}
          onClick={() => useUIStore.getState().toggleDesktopSidebar()}
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile sidebar */}
      <motion.div
        className="fixed inset-y-0 left-0 z-40 w-80 min-w-[320px] max-w-[320px] md:hidden"
        initial={{ x: '-100%' }}
        animate={{ x: open ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {sidebarContent}
      </motion.div>

      <ConfirmDialog
        isOpen={!!chatToDelete}
        onClose={() => setChatToDelete(null)}
        onConfirm={() => {
          if (chatToDelete) {
            deleteChat(chatToDelete);
            if (pathname.includes(chatToDelete)) router.push('/chat');
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
    </>
  );
}
