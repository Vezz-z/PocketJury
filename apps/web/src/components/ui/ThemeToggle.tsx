// ==============================================================================
// PocketJury — ThemeToggle Component
// ==============================================================================
'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export function ThemeToggle({ className = '' }: { className?: string }) {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
        // Prevent hydration mismatch by rendering a placeholder
        return (
            <button
                className={`p-2 rounded-lg bg-[var(--color-surface-elevated)] ${className}`}
                aria-label="Toggle theme"
            >
                <div className="h-4 w-4" />
            </button>
        );
    }

    const isDark = resolvedTheme === 'dark';

    return (
        <button
            className={`p-2 rounded-lg transition-all duration-200
        bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border)]
        text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
        ${className}`}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isDark ? (
                <Sun className="h-4 w-4" />
            ) : (
                <Moon className="h-4 w-4" />
            )}
        </button>
    );
}
