import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Triage Chat - Health Navigation for the Uninsured',
  description:
    'Get evidence-based guidance on whether you need medical care and find affordable options nearby. Designed for uninsured adults aged 26-40.',
  keywords:
    'health triage, uninsured healthcare, affordable medical care, urgent care finder, medical advice',
    robots: 'noindex, nofollow', // Prevent indexing during development
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div role="note" className="bg-amber-100 text-amber-900 text-center text-sm py-1">
          Sample data. Not medical advice.
        </div>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          {children}
        </div>
      </body>
    </html>
  );
}
