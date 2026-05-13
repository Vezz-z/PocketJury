// ==============================================================================
// PocketJury — Offline Fallback Page
// ==============================================================================
'use client';

import { Scale, WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 dark:bg-blue-900/30">
          <WifiOff className="h-10 w-10 text-primary-600 dark:text-blue-400" />
        </div>
        <div className="flex items-center justify-center gap-2 mb-4">
          <Scale className="h-6 w-6 text-primary-600 dark:text-blue-400" />
          <h1 className="text-2xl font-bold text-heading">PocketJury</h1>
        </div>
        <h2 className="text-lg font-semibold text-heading mb-2">
          You&apos;re Offline
        </h2>
        <p className="text-body text-sm leading-relaxed mb-6">
          It looks like you&apos;ve lost your internet connection. Please check your
          network and try again. Some features may still be available from cache.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary px-8 py-2.5"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
