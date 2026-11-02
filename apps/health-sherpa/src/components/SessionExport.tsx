'use client';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDocumentState, useChatState, useUIState } from '@/store/hooks';
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function SessionExportButton() {
  const { activeDocument, clearActiveDocument } = useDocumentState();
  const { currentSession, clearCurrentSession } = useChatState();
  const { isLoading } = useUIState();
  const { toast } = useToast();

  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!activeDocument && !currentSession) {
      toast({
        title: 'Export Failed',
        description: 'No active session to export.',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      // Create a simple text export for now
      // In the future, this could be enhanced with PDF generation
      const exportData = {
        timestamp: new Date().toISOString(),
        document: activeDocument
          ? {
              filename: activeDocument.filename,
              uploadedAt: activeDocument.uploadedAt,
              content: activeDocument.content,
            }
          : null,
        session: currentSession
          ? {
              id: currentSession.id,
              messages: currentSession.messages,
              createdAt: currentSession.createdAt,
              updatedAt: currentSession.updatedAt,
            }
          : null,
      };

      // Create and download the export file
      const exportString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([exportString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `health-sherpa-session-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Session Exported',
        description:
          'Your session data has been downloaded. Session has been reset.',
      });

      // Clear the session data
      if (activeDocument) {
        clearActiveDocument();
      }
      if (currentSession) {
        clearCurrentSession();
      }
    } catch (error) {
      console.error('Error exporting session:', error);
      toast({
        title: 'Export Failed',
        description: 'An error occurred while exporting the session.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const hasData =
    activeDocument || (currentSession && currentSession.messages.length > 0);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          disabled={!hasData || isExporting}
          className="w-full justify-start text-left"
          variant="outline"
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export & End Session
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
            Export Session & End?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will export your session data and permanently clear all data
            from this session. You won&apos;t be able to continue this
            conversation afterward.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleExport}
            disabled={isExporting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              'Export & End Session'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
