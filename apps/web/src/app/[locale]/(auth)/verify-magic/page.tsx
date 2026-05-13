// ==============================================================================
// PocketJury — Magic Link Verification Page
// ==============================================================================
'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Scale, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store';
import { toast } from 'sonner';

type VerifyState = 'loading' | 'success' | 'error';

export default function VerifyMagicPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const hasAttempted = useRef(false);

  // Get the fetchWithAuth-based API URL
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

  useEffect(() => {
    // Prevent double-fire in React strict mode
    if (hasAttempted.current) return;
    hasAttempted.current = true;

    const token = searchParams.get('token');

    if (!token) {
      setState('error');
      setErrorMessage('No token found in the URL.');
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/auth/magic-link/verify?token=${encodeURIComponent(token)}`,
          {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          setState('error');
          setErrorMessage(data.error || 'Verification failed. The link may have expired.');
          return;
        }

        // Set auth state
        useAuthStore.getState().fetchProfile?.();
        setState('success');
        toast.success('Logged in successfully!');

        // Redirect after short delay
        setTimeout(() => {
          router.push('/chat');
        }, 1500);
      } catch {
        setState('error');
        setErrorMessage('Something went wrong. Please try again.');
      }
    };

    verifyToken();
  }, [searchParams, router, API_BASE]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-primary-50 via-[var(--color-bg)] to-secondary-50 dark:from-blue-950/20 dark:via-[var(--color-bg)] dark:to-green-950/10">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <Scale className="h-8 w-8 text-primary-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-heading">PocketJury</span>
          </Link>
        </div>

        <div className="card p-8 text-center">
          {/* Loading */}
          {state === 'loading' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-blue-900/30">
                <Loader2 className="h-8 w-8 text-primary-600 dark:text-blue-400 animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-heading">Verifying your link</h2>
                <p className="mt-1 text-sm text-body">Please wait a moment...</p>
              </div>
            </motion.div>
          )}

          {/* Success */}
          {state === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-heading">You&apos;re in!</h2>
                <p className="mt-1 text-sm text-body">Redirecting you to PocketJury...</p>
              </div>
              <div className="w-full bg-[var(--color-border)] rounded-full h-1 overflow-hidden">
                <motion.div
                  className="h-full bg-green-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.5 }}
                />
              </div>
            </motion.div>
          )}

          {/* Error */}
          {state === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-heading">Verification failed</h2>
                <p className="mt-1 text-sm text-body">{errorMessage}</p>
              </div>
              <Link
                href="/login"
                className="btn-primary inline-block px-6 py-2.5"
              >
                Back to login
              </Link>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
