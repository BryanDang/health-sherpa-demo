'use client';

import dynamic from 'next/dynamic';

// Dynamically import the main layout with SSR disabled
const MainLayout = dynamic(() => import('@/components/MainLayout'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="text-2xl font-bold text-primary mb-2">
          Health Sherpa
        </div>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    </div>
  ),
});

export default function Home() {
  return <MainLayout />;
}
