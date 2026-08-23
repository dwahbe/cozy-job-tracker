import type { Metadata } from 'next';
import { Nunito, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SessionProvider } from 'next-auth/react';
import { SiteHeader } from './components/SiteHeader';
import { ToastHost } from './components/Toast';
import './globals.css';

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://cozyjobtracker.com'),
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
      <body className={`${nunito.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <SiteHeader />
          {children}
        </SessionProvider>
        <ToastHost />
        <Analytics />
      </body>
    </html>
  );
}
