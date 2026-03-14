// ==============================================================================
// PocketJury — Zustand UI Store
// ==============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarOpen: boolean;
  desktopSidebarOpen: boolean;
  onboardingStep: number;
  showDisclaimer: boolean;
  showConsent: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleDesktopSidebar: () => void;
  setDesktopSidebarOpen: (open: boolean) => void;
  setOnboardingStep: (step: number) => void;
  setShowDisclaimer: (show: boolean) => void;
  setShowConsent: (show: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      desktopSidebarOpen: true,
      onboardingStep: 0,
      showDisclaimer: false,
      showConsent: true,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleDesktopSidebar: () => set((s) => ({ desktopSidebarOpen: !s.desktopSidebarOpen })),
      setDesktopSidebarOpen: (open) => set({ desktopSidebarOpen: open }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      setShowDisclaimer: (show) => set({ showDisclaimer: show }),
      setShowConsent: (show) => set({ showConsent: show }),
    }),
    {
      name: 'pocketjury-ui',
      partialize: (state) => ({
        desktopSidebarOpen: state.desktopSidebarOpen,
      }),
    },
  ),
);
