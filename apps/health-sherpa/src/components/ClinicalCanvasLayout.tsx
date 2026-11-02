// src/components/ClinicalCanvasLayout.tsx
// Clinical canvas layout component for phase-based workflow display

'use client';

import { usePhaseState, useUIState } from '@/store/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ClinicalCanvasLayoutProps {
  children?: React.ReactNode;
}

export function ClinicalCanvasLayout({ children }: ClinicalCanvasLayoutProps) {
  const { currentPhase, phaseProgress } = usePhaseState();
  const { isProviderMode } = useUIState();

  return (
    <div className="h-full flex flex-col">
      {/* Phase Header */}
      <div className="border-b bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Phase {currentPhase} - {getPhaseTitle(currentPhase)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isProviderMode ? 'Provider View' : 'Patient View'}
            </p>
          </div>
          <div className="flex space-x-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i <= currentPhase
                    ? 'bg-primary'
                    : phaseProgress[i as 0 | 1 | 2 | 3 | 4]
                      ? 'bg-primary/50'
                      : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 overflow-hidden">
        {children || (
          <div className="h-full flex items-center justify-center">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>Clinical Canvas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Phase {currentPhase} analysis and insights will be displayed
                  here.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function getPhaseTitle(phase: number): string {
  switch (phase) {
    case 0:
      return 'Trust & Setup';
    case 1:
      return 'Summary';
    case 2:
      return 'Insights';
    case 3:
      return 'Synthesis';
    case 4:
      return 'Actions';
    default:
      return 'Unknown Phase';
  }
}
