// File: src/components/ProviderModeToggle.tsx
// Interacts with: MainLayout.tsx, modular store

'use client';

import { useState, useEffect } from 'react';
import { useUIState } from '@/store/hooks';

export function ProviderModeToggle() {
  const { isProviderMode, setProviderMode } = useUIState();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div className="h-8 w-32 bg-gray-200 animate-pulse rounded" />;
  }

  const toggleProviderMode = () => setProviderMode(!isProviderMode);

  return (
    <div className="flex items-center space-x-2 text-sm">
      <button
        onClick={() => isProviderMode && toggleProviderMode()}
        className={`px-3 py-1 rounded transition-colors ${
          !isProviderMode
            ? 'font-bold text-foreground bg-secondary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        For Patients
      </button>
      <button
        onClick={() => !isProviderMode && toggleProviderMode()}
        className={`px-3 py-1 rounded transition-colors ${
          isProviderMode
            ? 'font-bold text-foreground bg-secondary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        For Providers
      </button>
    </div>
  );
}
