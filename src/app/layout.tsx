
import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'DROP IT | Acoustic Neural Engine',
  description: 'Professional-grade sonic architecture. Record, synthesize, and manifest rhythm with high-fidelity neural precision.',
  appleWebApp: {
    title: 'DROP IT',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#facc15',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary selection:text-black overflow-x-hidden">
        {/* Professional CRT Scanline Overlay */}
        <div className="fixed inset-0 pointer-events-none z-[9999] opacity-[0.03] scanline-effect" />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
