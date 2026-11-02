'use client';

import React from 'react';

interface MinimalProps {
  userId?: string;
}

export default function EnhancedTriageChatMinimal({
  userId = 'test',
}: MinimalProps) {
  return (
    <div className="p-4">
      <h1>Enhanced Triage Chat - Minimal Test</h1>
      <p>If you can see this, the basic component works</p>
      <p>User ID: {userId}</p>
      <button className="bg-blue-500 text-white px-4 py-2 rounded">
        Test Button
      </button>
    </div>
  );
}
