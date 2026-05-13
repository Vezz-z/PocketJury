// ==============================================================================
// PocketJury — Zustand Auth Store
// ==============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { authApi, userApi } from '@/lib/api';

const cookieStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop()?.split(';').shift() || '');
    return null;
  },
  setItem: (name: string, value: string): void => {
    if (typeof document === 'undefined') return;
    const rememberMe = typeof window !== 'undefined' ? localStorage.getItem('pocketjury-remember') === 'true' : false;
    let expires = '';
    if (rememberMe) {
      const date = new Date();
      date.setTime(date.getTime() + (7 * 24 * 60 * 60 * 1000));
      expires = `; expires=${date.toUTCString()}`;
    }
    document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; samesite=strict`;
  },
  removeItem: (name: string): void => {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  },
};

interface User {
  id: string;
  email: string;
  role: string;
  preferredLanguage: string;
  personaMode: string;
  authProvider?: string;
  profile?: {
    fullName?: string;
    dateOfBirth?: string;
    locationState?: string;
    locationDistrict?: string;
    professionType?: string;
    fieldOfStudy?: string;
    currentProfession?: string;
    profileCompleted: boolean;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string, fullName: string, preferredLanguage?: string) => Promise<any>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  verifyMfa: (email: string, code: string) => Promise<void>;
  googleAuth: (token: string, accessToken?: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Record<string, unknown>) => Promise<void>;
  updateLanguage: (language: string) => Promise<void>;
  updatePersona: (persona: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.login({ email, password });
          if (data.mfaRequired) {
            set({ isLoading: false });
            return data;
          }
          set({ user: data.user, isAuthenticated: true, isLoading: false });
          return data;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (email, password, fullName, preferredLanguage) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.register({ email, password, fullName, preferredLanguage });
          // Don't set isAuthenticated here — user must verify email first
          set({ isLoading: false });
          return data;
        } catch (err: unknown) {
          let message = 'Registration failed';
          if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 409) {
            message = 'An account with this email already exists';
          } else if (err && typeof err === 'object' && 'data' in err) {
            const apiData = (err as { data: unknown }).data;
            if (apiData && typeof apiData === 'object' && 'error' in apiData) {
              message = String((apiData as { error: string }).error);
            }
          } else if (err instanceof Error) {
            message = err.message;
          }
          set({ error: message, isLoading: false });
          throw new Error(message);
        }
      },

      verifyEmail: async (email, code) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.verifyEmail({ email, code });
          if (data.mfaRequired) {
             set({ isLoading: false });
             throw new Error("MFA Required");
          }
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Verification failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      verifyMfa: async (email, code) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.verifyMfa({ email, code });
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'MFA failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      googleAuth: async (token, accessToken) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.googleAuth(token, accessToken);
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Google auth failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // Ignore
        }
        set({ user: null, isAuthenticated: false, error: null });
      },

      fetchProfile: async () => {
        try {
          const data = await userApi.getProfile();
          // Map profile.personaMode to top level so settings page can read user.personaMode
          const user = {
            ...data,
            personaMode: data.personaMode || data.profile?.personaMode || 'GENERAL',
          };
          set({ user, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },

      updateProfile: async (data) => {
        const response = await userApi.updateProfile(data);
        const current = get().user;
        if (current) {
          set({ user: { ...current, profile: response } });
        }
      },

      updateLanguage: async (language) => {
        await userApi.updateLanguage(language);
        const current = get().user;
        if (current) {
          set({ user: { ...current, preferredLanguage: language } });
        }
      },

      updatePersona: async (persona) => {
        await userApi.updatePersona(persona);
        const current = get().user;
        if (current) {
          set({ user: { ...current, personaMode: persona } });
        }
      },

      changePassword: async (currentPassword, newPassword) => {
        set({ isLoading: true, error: null });
        try {
          await authApi.changePassword({ currentPassword, newPassword });
          set({ isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Password change failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'pocketjury-auth',
      storage: createJSONStorage(() => cookieStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
