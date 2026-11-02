'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

// Import components
import AppLogo from '@/components/AppLogo';
import { DocumentUpload } from '@/components/DocumentUpload';
import { InsightsDisplay } from '@/components/insights/InsightsDisplayRouter';
import ChatInterface from '@/components/ChatInterface';
import { ProviderModeToggle } from '@/components/ProviderModeToggle';
import { LanguageDropdown } from '@/components/LanguageDropdown';
import {
  PrivacyReportModal,
  PrivacyReportTrigger,
} from '@/components/PrivacyReportModal';
import { ClinicalCanvasLayout } from '@/components/ClinicalCanvasLayout';
import { ModelSelector } from '@/components/ModelSelector';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FileText, History } from 'lucide-react';
import { useDocumentState, useUIState, usePhaseState } from '@/store/hooks';

export default function MainLayout() {
  // Use Zustand store for proper state management
  const { activeDocument } = useDocumentState();
  const { isProviderMode, error, openPrivacyModal } = useUIState();
  const { currentPhase } = usePhaseState();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Show clinical canvas when document is processed and privacy modal is closed
  const showClinicalCanvas = isClient && activeDocument?.deidentified;

  // Handler for de-identified patient history button
  const handlePatientHistoryClick = () => {
    if (activeDocument) {
      openPrivacyModal();
    }
  };

  return (
    <div className="flex flex-col min-h-full md:h-full bg-background text-foreground font-sans">
      <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 p-3 md:p-4 border-b bg-background/80 backdrop-blur-md shadow-sm">
        {/* Left side: Logo + Toggle */}
        <div className="flex items-center space-x-4">
          <AppLogo />
          <ProviderModeToggle />
        </div>

        {/* Right side: Model selector + Language dropdown */}
        <div className="flex items-center space-x-2">
          <ModelSelector />
          <LanguageDropdown />
        </div>
      </header>

      {/* Main Header Text + Disclaimer - Conditional based on mode */}
      <div className="px-4 py-6 text-center border-b bg-background">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          {showClinicalCanvas
            ? `Phase ${currentPhase}: Clinical Analysis in Progress`
            : isProviderMode
              ? "Speak to your client's concerns with their history in mind."
              : 'Ever feel like health records are written in a different language?'}
        </h1>
        <p className="text-base md:text-lg text-muted-foreground mb-4">
          {showClinicalCanvas
            ? 'AI-powered analysis using your de-identified health document'
            : isProviderMode
              ? 'Translate data. Ask better questions. Act with clarity — and evidence.'
              : 'Understand your doctor. Speak their language. And (coming soon!) help them find you.'}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="m-4 rounded-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <main className="flex flex-col md:flex-row flex-1 md:overflow-hidden p-2 md:p-4 gap-2 md:gap-4">
        {showClinicalCanvas ? (
          /* Clinical Canvas Layout */
          <div className="w-full h-full min-h-[32rem]">
            <ClinicalCanvasLayout>
              <div className="h-full flex flex-col md:flex-row">
                {/* Left Panel - Insights */}
                <aside className="w-full md:w-1/3 flex flex-col gap-4 md:max-h-full md:pr-4 mb-4 md:mb-0">
                  <div className="flex-grow rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">
                        Document Insights
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {activeDocument?.filename || 'Processing...'}
                      </span>
                      {activeDocument && (
                        <div className="flex gap-1">
                          <PrivacyReportTrigger className="ml-2" />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={handlePatientHistoryClick}
                          >
                            <History className="h-3 w-3 mr-1" />
                            Patient History
                          </Button>
                        </div>
                      )}
                    </div>
                    <InsightsDisplay />
                  </div>
                </aside>

                {/* Right Panel - Chat */}
                <section className="w-full md:w-2/3 flex flex-col md:max-h-full min-h-[24rem]">
                  <div className="flex-1 border rounded-lg min-h-[24rem]">
                    <ChatInterface className="h-full" />
                  </div>
                </section>
              </div>
            </ClinicalCanvasLayout>
          </div>
        ) : (
          /* Default Layout - Upload and Chat */
          <>
            {/* Left Panel - Insights + Upload Integration */}
            <aside
              className={`${activeDocument ? 'w-full md:w-1/3 lg:w-2/5' : 'w-full md:w-1/4 lg:w-1/5'} flex flex-col gap-4 max-h-full transition-all duration-200`}
            >
              {activeDocument && !showClinicalCanvas && (
                <div className="flex-grow rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Document Insights</h3>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {activeDocument?.filename || 'Processing...'}
                    </span>
                    <div className="flex gap-1">
                      <PrivacyReportTrigger className="ml-2" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={handlePatientHistoryClick}
                      >
                        <History className="h-3 w-3 mr-1" />
                        Patient History
                      </Button>
                    </div>
                  </div>
                  <InsightsDisplay />
                </div>
              )}

              {/* Upload Interface */}
              {!activeDocument && (
                <div className="flex flex-col h-full justify-center px-2">
                  <DocumentUpload />
                </div>
              )}
            </aside>

            {/* Right Panel - Chat (expands when no document) */}
            <section
              className={`${activeDocument ? 'w-full md:w-2/3 lg:w-3/5' : 'w-full md:w-3/4 lg:w-4/5'} flex flex-col max-h-full transition-all duration-200`}
            >
              <div className="flex-1 border rounded-lg min-h-[24rem]">
                <ChatInterface className="h-full" />
              </div>
            </section>
          </>
        )}
      </main>

      {/* Modals */}
      <PrivacyReportModal />
    </div>
  );
}
