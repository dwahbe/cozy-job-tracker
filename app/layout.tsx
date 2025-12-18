import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { Analytics } from '@vercel/analytics/next';
import CopyLink from './components/CopyLink';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'cozy job tracker',
  description: 'calm tracking for a noisy job search',
  openGraph: {
    title: 'cozy job tracker',
    description: 'calm tracking for a noisy job search',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'cozy job tracker',
    description: 'calm tracking for a noisy job search',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="topbar">
          <div className="container-app h-14 flex items-center justify-between">
            <Link href="/" className="brand">
              cozy job tracker
            </Link>
            <div className="text-sm muted hidden sm:block">
              calm tracking for a noisy job search
            </div>
          </div>
        </header>
        {children}
        <Analytics />
        <footer className="footer">
          <div className="container-app text-center space-y-3">
            <CopyLink />
            <div className="flex items-center justify-center gap-2 text-sm">
              <a
                href="https://github.com/dwahbe/cozy-job-tracker"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:underline"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                open source
              </a>
              <span className="muted">·</span>
              <span className="muted">
                built by{' '}
                <a href="https://dylanwahbe.com" target="_blank" rel="noopener noreferrer">
                  Dylan Wahbe
                </a>
              </span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
