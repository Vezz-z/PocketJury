'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, LogOut, X } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: 'trash' | 'logout' | 'alert';
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  icon = 'alert',
  isLoading = false,
}: ConfirmDialogProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const IconComponent = icon === 'trash' ? Trash2 : icon === 'logout' ? LogOut : AlertTriangle;
  
  const iconColorClass = 
    variant === 'danger' ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30' :
    variant === 'warning' ? 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30' :
    'text-primary-600 dark:text-blue-400 bg-primary-100 dark:bg-blue-900/30';

  const buttonClass = 
    variant === 'danger' ? 'btn-danger' :
    variant === 'warning' ? 'btn-accent' :
    'btn-primary';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={!isLoading ? onClose : undefined}
          />
          
          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 py-safe sm:p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card w-full max-w-md rounded-2xl shadow-xl border overflow-hidden pointer-events-auto"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-full flex-shrink-0 ${iconColorClass}`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  
                  <div className="flex-1 mt-1">
                    <h3 className="text-lg font-bold text-heading">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm text-body leading-relaxed">
                      {description}
                    </p>
                  </div>

                  <button 
                    onClick={onClose}
                    disabled={isLoading}
                    className="p-1 rounded-md text-muted hover:text-heading hover:bg-elevated transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              
              <div className="bg-elevated px-6 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="btn-ghost"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`${buttonClass} min-w-[100px]`}
                >
                  {isLoading ? (
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
