'use client';

import React, { useState, useEffect } from 'react';
import MainLayout from './MainLayout';

export default function ClientOnlyLayout() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Return a loading placeholder during SSR
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary mb-2">
            Health Sherpa
          </div>
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  return <MainLayout />;
}
