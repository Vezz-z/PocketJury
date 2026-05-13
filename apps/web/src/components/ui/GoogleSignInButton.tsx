// ==============================================================================
// PocketJury — Google Sign-In Button (Google Identity Services)
// ==============================================================================
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

// Google Identity Services type declarations
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          prompt: (callback?: (notification: PromptNotification) => void) => void;
          renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void;
          cancel: () => void;
        };
        oauth2: {
          initTokenClient: (config: GoogleTokenConfig) => GoogleTokenClient;
        };
      };
    };
  }
}

interface GoogleTokenConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: any) => void;
}

interface GoogleTokenResponse {
  access_token: string;
  error?: string;
}

interface GoogleIdConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  itp_support?: boolean;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
}

interface PromptNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  getNotDisplayedReason: () => string;
  getSkippedReason: () => string;
}

interface GoogleButtonOptions {
  type: 'standard' | 'icon';
  theme: 'outline' | 'filled_blue' | 'filled_black';
  size: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: string;
  locale?: string;
}

interface GoogleSignInButtonProps {
  /** Where to redirect after successful auth */
  redirectTo?: string;
  /** Button label mode */
  mode?: 'signin' | 'signup';
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export function GoogleSignInButton({
  redirectTo = '/chat',
  mode = 'signin',
}: GoogleSignInButtonProps) {
  const t = useTranslations('auth');
  const router = useRouter();
  const googleAuth = useAuthStore((s) => s.googleAuth);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [gsiLoaded, setGsiLoaded] = useState(false);
  const [gsiError, setGsiError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Handle Google credential response
  const handleCredentialResponse = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        toast.error(t('googleAuthError'));
        return;
      }

      setIsProcessing(true);
      const doAuth = async (credential: string, accessToken?: string) => {
        try {
          await googleAuth(credential, accessToken);
          toast.success(t('loginSuccess'));
          router.push(redirectTo);
        } catch {
          toast.error(t('googleAuthError'));
        } finally {
          setIsProcessing(false);
        }
      };

      if (mode === 'signup' && window.google?.accounts?.oauth2) {
        try {
          const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID!,
            scope: 'https://www.googleapis.com/auth/user.birthday.read',
            callback: (tokenResponse) => {
              if (tokenResponse.error) {
                doAuth(response.credential);
              } else {
                doAuth(response.credential, tokenResponse.access_token);
              }
            },
          });
          tokenClient.requestAccessToken();
        } catch (err) {
          console.error("Failed to init token client", err);
          doAuth(response.credential);
        }
      } else {
        doAuth(response.credential);
      }
    },
    [googleAuth, router, redirectTo, t, mode],
  );

  // Load and initialize the Google Identity Services script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured');
      setGsiError(true);
      return;
    }

    // Check if script is already loaded
    if (window.google?.accounts?.id) {
      setGsiLoaded(true);
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector(
      `script[src="${GIS_SCRIPT_URL}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => setGsiLoaded(true));
      existingScript.addEventListener('error', () => setGsiError(true));
      return;
    }

    // Load the GIS script
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => setGsiLoaded(true);
    script.onerror = () => {
      setGsiError(true);
      console.error('Failed to load Google Identity Services script');
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup: cancel any pending prompts on unmount
      try {
        window.google?.accounts?.id?.cancel();
      } catch {
        // Ignore
      }
    };
  }, []);

  // Initialize Google Sign-In once the script is loaded
  useEffect(() => {
    if (!gsiLoaded || !GOOGLE_CLIENT_ID || initializedRef.current) return;
    if (!window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
      });

      // Render the official Google button inside our container
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: mode === 'signup' ? 'signup_with' : 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: buttonRef.current.offsetWidth.toString(),
        });
      }

      initializedRef.current = true;
    } catch (err) {
      console.error('Failed to initialize Google Sign-In:', err);
      setGsiError(true);
    }
  }, [gsiLoaded, handleCredentialResponse, mode]);

  // Loading / error / disabled states → show custom fallback button
  const showFallback = !gsiLoaded || gsiError || !GOOGLE_CLIENT_ID;
  const busy = isLoading || isProcessing;

  return (
    <div className="w-full">
      {/* Google's rendered button (hidden when fallback is shown) */}
      <div
        ref={buttonRef}
        className={`google-signin-container w-full ${showFallback ? 'hidden' : ''}`}
        style={{ minHeight: 44 }}
      />

      {/* Fallback button — shown while loading, on error, or if no Client ID */}
      {showFallback && (
        <button
          type="button"
          disabled={busy || gsiError || !GOOGLE_CLIENT_ID}
          className="btn-outline w-full py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            if (!GOOGLE_CLIENT_ID) {
              toast.error('Google Sign-In is not configured');
              return;
            }
            if (gsiError) {
              toast.error('Failed to load Google Sign-In. Please refresh.');
              return;
            }
          }}
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              {t('signingInWithGoogle')}
            </span>
          ) : (
            <>
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {gsiError
                ? t('googleAuthUnavailable') || 'Google Sign-In unavailable'
                : !GOOGLE_CLIENT_ID
                  ? t('googleAuthNotConfigured') || 'Google Sign-In not configured'
                  : mode === 'signup' ? t('signupWithGoogle') : t('continueWithGoogle')}
            </>
          )}
        </button>
      )}
    </div>
  );
}
