import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Health Sherpa',
  description: 'Navigate your health journey with guided insights.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans flex flex-col h-screen">
        <div
          role="note"
          className="shrink-0 bg-amber-100 text-amber-900 text-center text-sm py-1"
        >
          Sample data. Not medical advice.
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
