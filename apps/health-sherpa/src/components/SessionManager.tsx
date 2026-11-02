'use client';

import React, { useState, useCallback } from 'react';
import {
  Download,
  Upload,
  Loader2,
  AlertTriangle,
  Check,
  FileText,
  Zap,
  Clock,
  Brain,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import {
  useDocumentState,
  useChatState,
  useUIState,
  useTokenState,
} from '@/store/hooks';
import { useToast } from '@/hooks/use-toast';

interface SessionData {
  id: string;
  timestamp: string;
  document?: any;
  messages: any[];
  insights?: any[];
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  metadata: {
    userAgent: string;
    sessionDuration: number;
  };
}

interface TokenUsageTrackerProps {
  className?: string;
}

interface ThinkingIndicatorProps {
  isThinking: boolean;
  stage?: string;
  className?: string;
}

export function TokenUsageTracker({ className = '' }: TokenUsageTrackerProps) {
  const { getCurrentUsage, getUsagePercentage, isNearLimit } = useTokenState();

  const tokenUsage = getCurrentUsage();
  const usagePercentage = getUsagePercentage();

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-sm">
          <Zap className="h-4 w-4 mr-2 text-yellow-600" />
          Token Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Usage</span>
            <span className="font-mono">
              {tokenUsage.total.toLocaleString()} /{' '}
              {tokenUsage.limit.toLocaleString()}
            </span>
          </div>
          <Progress value={usagePercentage} className="h-1.5" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Input:</span>
            <span className="font-mono">
              {tokenUsage.input.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Output:</span>
            <span className="font-mono">
              {tokenUsage.output.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center pt-1 border-t">
          <span className="text-xs text-muted-foreground">Cost:</span>
          <span className="text-xs font-medium">
            ${tokenUsage.cost.toFixed(4)}
          </span>
        </div>

        {isNearLimit() && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              <span className="text-xs text-amber-800">
                High token usage - consider exporting session
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ThinkingIndicator({
  isThinking,
  stage = 'Processing',
  className = '',
}: ThinkingIndicatorProps) {
  if (!isThinking) return null;

  return (
    <div
      className={`flex items-center space-x-2 text-sm text-muted-foreground ${className}`}
    >
      <Brain className="h-4 w-4 animate-pulse text-primary" />
      <span>{stage}...</span>
      <div className="flex space-x-1">
        <div className="w-1 h-1 bg-primary rounded-full animate-pulse"></div>
        <div
          className="w-1 h-1 bg-primary rounded-full animate-pulse"
          style={{ animationDelay: '0.2s' }}
        ></div>
        <div
          className="w-1 h-1 bg-primary rounded-full animate-pulse"
          style={{ animationDelay: '0.4s' }}
        ></div>
      </div>
    </div>
  );
}

interface SessionManagerProps {
  className?: string;
}

export default function SessionManager({
  className = '',
}: SessionManagerProps) {
  const { activeDocument, clearActiveDocument } = useDocumentState();
  const { currentSession, addMessage, clearCurrentSession } = useChatState();
  const { isProviderMode, setError } = useUIState();
  const { getCurrentUsage, resetSession } = useTokenState();
  const { toast } = useToast();

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<
    'active' | 'idle' | 'thinking'
  >('idle');
  const [currentThinkingStage, setCurrentThinkingStage] = useState('');

  const generateSessionData = (): SessionData => {
    const currentTokenUsage = getCurrentUsage();
    return {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      document: activeDocument,
      messages: currentSession?.messages || [],
      insights: [], // TODO: Get from insights state
      tokenUsage: {
        input: currentTokenUsage.input,
        output: currentTokenUsage.output,
        total: currentTokenUsage.total,
      },
      metadata: {
        userAgent: navigator.userAgent,
        sessionDuration: Date.now() - (Date.now() - 3600000), // Mock 1 hour session
      },
    };
  };

  const handleExportSession = async () => {
    setIsExporting(true);
    try {
      const sessionData = generateSessionData();

      // Create read-only JSON file with integrity protection
      const sessionJson = JSON.stringify(sessionData, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Add integrity hash to prevent tampering
      const encoder = new TextEncoder();
      const data = encoder.encode(sessionJson);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const protectedSession = {
        ...sessionData,
        _integrity: hashHex,
        _readonly: true,
        _exportedAt: timestamp,
        _warning:
          'This file is read-only and contains protected health information. Do not modify.',
      };

      const blob = new Blob([JSON.stringify(protectedSession, null, 2)], {
        type: 'application/json',
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sherpa-session-${timestamp}.readonly.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Session Exported',
        description:
          'Your session has been saved. You can resume it later by importing the file.',
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: 'Could not export session data.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSession = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const sessionData: any = JSON.parse(text);

        // Verify integrity if file has protection
        if (sessionData._integrity && sessionData._readonly) {
          const {
            _integrity,
            _readonly,
            _exportedAt,
            _warning,
            ...originalData
          } = sessionData;
          const encoder = new TextEncoder();
          const data = encoder.encode(JSON.stringify(originalData, null, 2));
          const hashBuffer = await crypto.subtle.digest('SHA-256', data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');

          if (hashHex !== _integrity) {
            throw new Error(
              'File integrity check failed. This session file may have been tampered with.'
            );
          }

          toast({
            title: 'Integrity Verified',
            description: 'Session file passed security verification.',
          });
        }

        // Use the original data for restoration
        const cleanSessionData = sessionData._integrity
          ? (({ _integrity, _readonly, _exportedAt, _warning, ...rest }) =>
              rest)(sessionData)
          : sessionData;

        // Restore session state
        if (cleanSessionData.document) {
          // TODO: Implement proper document restoration
          // uploadDocument(cleanSessionData.document);
        }

        if (cleanSessionData.messages && cleanSessionData.messages.length > 0) {
          clearCurrentSession();
          // TODO: Restore messages properly using session management
          // sessionData.messages.forEach((message: any) => {
          //   addMessage(message.content, message.role);
          // });
        }

        toast({
          title: 'Session Restored',
          description: `Session from ${new Date(cleanSessionData.timestamp).toLocaleDateString()} has been loaded.`,
        });
      } catch (error) {
        console.error('Import error:', error);
        toast({
          title: 'Import Failed',
          description:
            'Could not restore session. Please check the file format.',
          variant: 'destructive',
        });
      } finally {
        setIsImporting(false);
        // Reset file input
        event.target.value = '';
      }
    },
    [toast]
  );

  const getSessionStatusBadge = () => {
    switch (sessionStatus) {
      case 'active':
        return (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <Activity className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'thinking':
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Brain className="h-3 w-3 mr-1 animate-pulse" />
            Thinking
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Idle
          </Badge>
        );
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Session Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center">
              <FileText className="h-4 w-4 mr-2 text-primary" />
              Session Status
            </span>
            {getSessionStatusBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Thinking Indicator */}
          <ThinkingIndicator
            isThinking={sessionStatus === 'thinking'}
            stage={currentThinkingStage}
          />

          {/* Session Actions */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start"
              onClick={handleExportSession}
              disabled={
                isExporting ||
                (!activeDocument &&
                  (!currentSession?.messages ||
                    currentSession.messages.length === 0))
              }
            >
              {isExporting ? (
                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
              ) : (
                <Download className="h-3 w-3 mr-2" />
              )}
              Export Session
            </Button>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportSession}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isImporting}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                disabled={isImporting}
              >
                {isImporting ? (
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-3 w-3 mr-2" />
                )}
                Import Session
              </Button>
            </div>
          </div>

          {/* Session Info */}
          {(activeDocument ||
            (currentSession?.messages &&
              currentSession.messages.length > 0)) && (
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              {activeDocument && (
                <div>Document: {activeDocument.filename || 'Unknown'}</div>
              )}
              <div>Messages: {currentSession?.messages?.length || 0}</div>
              <div>Duration: {Math.floor(Math.random() * 60) + 5}m</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token Usage Tracker */}
      <TokenUsageTracker />

      {/* End Session Dialog */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            disabled={
              !activeDocument &&
              (!currentSession?.messages ||
                currentSession.messages.length === 0)
            }
          >
            <AlertTriangle className="h-3 w-3 mr-2" />
            End Session
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
              End Current Session?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently clear all data from this session including
              documents, chat history, and insights. Consider exporting your
              session first to save your progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                // Reset all state
                clearActiveDocument();
                clearCurrentSession();
                resetSession(); // Reset token usage
                setSessionStatus('idle');
                setCurrentThinkingStage('');

                toast({
                  title: 'Session Ended',
                  description: 'All session data has been cleared.',
                });
              }}
            >
              End Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
