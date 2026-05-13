// ==============================================================================
// PocketJury — Guest Layout (unauthenticated "Try Now" mode)
// No auth checks, uses GuestSidebar + GuestHeader
// ==============================================================================
'use client';

import { useState, type ReactNode } from 'react';
import { GuestSidebar } from '@/components/layout/GuestSidebar';
import { GuestHeader } from '@/components/layout/GuestHeader';
import { useUIStore } from '@/store';

export default function GuestLayout({ children }: { children: ReactNode }) {
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const desktopSidebarOpen = useUIStore((s) => s.desktopSidebarOpen);

  return (
    <div className="flex h-screen bg-page overflow-hidden">
      {/* Sidebar */}
      <GuestSidebar
        open={sidebarOpen}
        desktopOpen={desktopSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <GuestHeader />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
