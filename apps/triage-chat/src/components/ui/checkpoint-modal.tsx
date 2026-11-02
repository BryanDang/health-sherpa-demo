'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Upload,
  Download,
  Copy,
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Target,
  Activity,
} from 'lucide-react';
import {
  SessionCheckpoint,
  CheckpointImportResult,
  useCheckpointExport,
  useCheckpointImport,
} from '@/lib/checkpoint-system';
import { PersistentMemory } from '@/lib/conversation-memory';

interface CheckpointModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'import' | 'export';
  currentMemory?: PersistentMemory;
  sessionDuration?: number;
  accomplishments?: string[];
  previousCheckpoint?: SessionCheckpoint;
  onImportComplete?: (result: CheckpointImportResult) => void;
}

export function CheckpointModal({
  isOpen,
  onClose,
  mode,
  currentMemory,
  sessionDuration = 0,
  accomplishments = [],
  previousCheckpoint,
  onImportComplete,
}: CheckpointModalProps) {
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const { exportCheckpoint, isExporting } = useCheckpointExport();
  const { importCheckpoint, isImporting, importResult, clearImportResult } =
    useCheckpointImport();

  const handleExport = async (format: 'file' | 'text') => {
    if (!currentMemory) return;

    const result = await exportCheckpoint(
      currentMemory,
      sessionDuration,
      accomplishments,
      previousCheckpoint,
      format
    );

    if (format === 'text' && typeof result === 'string') {
      setExportText(result);
    }

    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleImport = async () => {
    if (!importText.trim()) return;

    const result = await importCheckpoint(importText, currentMemory);

    if (result.success && onImportComplete) {
      onImportComplete(result);
      onClose();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportText(content);
      };
      reader.readAsText(file);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  if (mode === 'export') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              Export Session Checkpoint
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">
                Session Summary
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700">Messages:</span>{' '}
                  {currentMemory?.sessionProgress.messagesExchanged || 0}
                </div>
                <div>
                  <span className="text-blue-700">Duration:</span>{' '}
                  {Math.round(sessionDuration)} minutes
                </div>
                <div className="col-span-2">
                  <span className="text-blue-700">Accomplished:</span>{' '}
                  {accomplishments.join(', ') || 'General guidance provided'}
                </div>
              </div>
            </div>

            <Tabs defaultValue="file" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">Download File</TabsTrigger>
                <TabsTrigger value="text">Copy Text</TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-4">
                <div className="text-center py-6">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 mb-4">
                    Download a structured JSON file containing your session
                    data, medical context, and learned preferences.
                  </p>
                  <Button
                    onClick={() => handleExport('file')}
                    disabled={isExporting}
                    className="w-full"
                  >
                    {isExporting ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Creating Checkpoint...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Checkpoint File
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Get your checkpoint as text that you can copy, save, or
                    share.
                  </p>
                  <Button
                    onClick={() => handleExport('text')}
                    disabled={isExporting}
                    variant="outline"
                    className="mb-4"
                  >
                    {isExporting ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Generate Text Checkpoint
                      </>
                    )}
                  </Button>

                  {exportText && (
                    <div className="space-y-2">
                      <Textarea
                        value={exportText}
                        readOnly
                        className="h-32 text-xs font-mono"
                      />
                      <Button
                        onClick={() => copyToClipboard(exportText)}
                        size="sm"
                        variant="outline"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy to Clipboard
                      </Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {showSuccess && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Checkpoint exported successfully! You can now use this to
                  resume your conversation later.
                </AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
              <strong>Privacy Note:</strong> This checkpoint contains your
              medical context and conversation history. Store it securely and
              only share with trusted healthcare providers or family members if
              needed.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Import mode
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-green-600" />
            Import Previous Session
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              Import a checkpoint from a previous session to continue where you
              left off. Your conversation history, preferences, and medical
              context will be restored.
            </p>
          </div>

          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text">Paste Text</TabsTrigger>
              <TabsTrigger value="file">Upload File</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  Paste your checkpoint data:
                </label>
                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Paste your exported checkpoint text here..."
                  className="mt-2 h-32 text-xs font-mono"
                />
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="text-center py-6">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="checkpoint-file"
                />
                <label
                  htmlFor="checkpoint-file"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Select Checkpoint File
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Choose a .json checkpoint file
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {importResult && (
            <div className="space-y-2">
              {importResult.success ? (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Checkpoint imported successfully!
                    {importResult.merged && (
                      <div className="mt-2 text-xs">
                        <strong>Previous sessions:</strong>{' '}
                        {importResult.merged.evolvingProfile.totalSessions}
                        <br />
                        <strong>Last goal:</strong>{' '}
                        {importResult.merged.currentSession.goal?.description}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Import failed: {importResult.errors.join(', ')}
                  </AlertDescription>
                </Alert>
              )}

              {importResult.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Warnings: {importResult.warnings.join(', ')}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={!importText.trim() || isImporting}
              className="flex-1"
            >
              {isImporting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import & Continue
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
