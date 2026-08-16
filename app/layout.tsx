import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterSW } from './register-sw';

export const metadata: Metadata = {
  title: 'GateZero – Keys never leave. Spend never surprises.',
  description:
    'Local-first zero-trust API gateway. Web Locks, File System Access, CostRadar kill-switch. 2% take-rate.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'GateZero'
  },
  icons: {
    icon: '/icon-512.png',
    apple: '/icon-512.png'
  }
};

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen bg-[#0a0a0a] text-zinc-50">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
