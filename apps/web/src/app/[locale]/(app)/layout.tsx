// ==============================================================================
// PocketJury — Authenticated App Layout (sidebar + header)
// ==============================================================================
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useUIStore } from '@/store';
import { Sidebar } from '@/components/layout/Sidebar';
import { AppHeader } from '@/components/layout/AppHeader';

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const desktopSidebarOpen = useUIStore((s) => s.desktopSidebarOpen);
  const [isChecking, setIsChecking] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand to hydrate from localStorage before checking auth
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    // If already hydrated (e.g. fast restore), set immediately
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!hydrated) return; // Don't redirect until hydration completes
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchProfile()
      .then(() => {
        const user = useAuthStore.getState().user;
        const currentPath = window.location.pathname;
        if (user && !user.profile?.profileCompleted && !currentPath.includes('/onboarding')) {
           router.push('/onboarding');
        }
      })
      .catch(() => {
        router.push('/login');
      })
      .finally(() => setIsChecking(false));
  }, [hydrated, isAuthenticated, router, fetchProfile]);

  if (!hydrated || !isAuthenticated || isChecking) return null;

  return (
    <div className="flex h-screen bg-page overflow-hidden">
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} desktopOpen={desktopSidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
