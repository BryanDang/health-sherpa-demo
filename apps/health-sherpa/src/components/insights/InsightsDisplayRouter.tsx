// src/components/insights/InsightsDisplayRouter.tsx
// Main router component for insights display
// Switches between provider and patient views based on mode

'use client';

import { useState, useEffect } from 'react';

// Placeholder components for the different insight displays
function ProviderInsightsDisplay() {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <h3 className="font-semibold text-lg mb-2">Provider Insights</h3>
      <p className="text-muted-foreground">
        Provider-specific insights and analysis will be displayed here.
      </p>
    </div>
  );
}

function PatientInsightsDisplay() {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <h3 className="font-semibold text-lg mb-2">Patient Insights</h3>
      <p className="text-muted-foreground">
        Patient-friendly insights and explanations will be displayed here.
      </p>
    </div>
  );
}

export function InsightsDisplay() {
  const [isProviderMode, setIsProviderMode] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="p-4 border rounded-lg bg-card">
        <div className="h-6 bg-gray-200 animate-pulse rounded mb-2" />
        <div className="h-4 bg-gray-200 animate-pulse rounded" />
      </div>
    );
  }

  return isProviderMode ? (
    <ProviderInsightsDisplay />
  ) : (
    <PatientInsightsDisplay />
  );
}
