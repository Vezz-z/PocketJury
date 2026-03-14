// ==============================================================================
// PocketJury — Zustand Auth Store
// ==============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, userApi } from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: string;
  preferredLanguage: string;
  personaMode: string;
  profile?: {
    fullName?: string;
    dateOfBirth?: string;
    locationState?: string;
    locationDistrict?: string;
    professionType?: string;
    fieldOfStudy?: string;
    currentProfession?: string;
    isProfileComplete: boolean;
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string, dateOfBirth: string, preferredLanguage?: string) => Promise<void>;
  googleAuth: (token: string) => Promise<void>;
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
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Login failed';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      register: async (email, password, fullName, dateOfBirth, preferredLanguage) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.register({ email, password, fullName, dateOfBirth, preferredLanguage });
          set({ user: data.user, isAuthenticated: true, isLoading: false });
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

      googleAuth: async (token) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.googleAuth(token);
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

      clearError: () => set({ error: null }),
    }),
    {
      name: 'pocketjury-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
