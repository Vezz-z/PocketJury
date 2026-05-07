import type { Metadata, Viewport } from 'next';
import { Noto_Sans } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import '../globals.css';

const notoSans = Noto_Sans({
  subsets: ['latin', 'devanagari'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PocketJury — AI Legal Assistant for India',
    template: '%s | PocketJury',
  },
  description:
    'Understand your legal rights with AI-powered guidance in English, Hindi, Tamil, and Bengali. Free legal information for Indian citizens.',
  keywords: [
    'legal aid India',
    'AI legal assistant',
    'Indian law',
    'BNS',
    'IPC',
    'free legal help',
    'NALSA',
    'DLSA',
    'legal rights India',
  ],
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'PocketJury — AI Legal Assistant for India',
    description: 'Understand your legal rights with AI-powered guidance in your language.',
    type: 'website',
    locale: 'en_IN',
    siteName: 'PocketJury',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1B3A5C' },
    { media: '(prefers-color-scheme: dark)', color: '#0F172A' },
  ],
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  const dir = locale === 'ar' || locale === 'ur' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${notoSans.variable} font-sans`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider messages={messages}>
            {children}
            <Toaster
              position="top-center"
              richColors
              closeButton
              toastOptions={{
                classNames: {
                  toast: 'rounded-[var(--radius-md)]',
                },
              }}
            />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
