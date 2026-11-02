'use client';

import React from 'react';
import { FileText, Shield, Upload } from 'lucide-react';

export default function DebugDocumentZone() {
  return (
    <div
      className="w-80 min-w-80 bg-red-100 border-r-4 border-red-500 flex flex-col"
      style={{ minHeight: '100vh', backgroundColor: '#fee2e2' }}
    >
      <div className="p-4 bg-red-200 border-b-2 border-red-400">
        <h2 className="text-lg font-bold text-red-800 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          DEBUG: Document Zone
          <Shield className="h-4 w-4 ml-2" />
        </h2>
        <p className="text-sm text-red-700 mt-1">
          This should be visible as a red sidebar
        </p>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <div className="border-2 border-dashed border-red-400 rounded-lg p-6 text-center bg-red-50">
          <Upload className="h-8 w-8 mx-auto text-red-600 mb-2" />
          <p className="font-medium text-red-800">Upload Document</p>
          <p className="text-xs text-red-600">Drag & drop or click to upload</p>
        </div>

        <div className="bg-red-50 p-3 rounded border border-red-300">
          <h3 className="font-medium text-red-800 mb-2">Session Management</h3>
          <button className="w-full bg-red-600 text-white px-3 py-2 rounded text-sm">
            Export Session
          </button>
        </div>

        <div className="bg-red-50 p-3 rounded border border-red-300">
          <h3 className="font-medium text-red-800 mb-2">AI Brain Status</h3>
          <p className="text-xs text-red-600">Model: Gemini Flash</p>
          <p className="text-xs text-red-600">Status: Ready</p>
        </div>
      </div>
    </div>
  );
}
