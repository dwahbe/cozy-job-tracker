import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
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
  title: 'Personal Job Board',
  description: 'Track your job applications with AI-powered parsing',
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
              Personal Job Board
            </Link>
            <div className="text-sm muted hidden sm:block">
              calm tracking for a noisy job search
            </div>
          </div>
        </header>
        {children}
        <footer className="footer">
          <div className="container-app">
            <span className="muted">Made to feel a little lighter.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
