'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  Shield,
  Check,
  X,
  Lock,
  AlertTriangle,
  FileText,
} from 'lucide-react';

interface DocumentReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalDocument: string;
  deidentifiedDocument: string;
  onAccept: (additionalRedactions?: string) => void;
  onReject: () => void;
  fileName?: string;
}

export default function DocumentReviewModal({
  isOpen,
  onClose,
  originalDocument,
  deidentifiedDocument,
  onAccept,
  onReject,
  fileName = 'Document',
}: DocumentReviewModalProps) {
  const [userRedactionNotes, setUserRedactionNotes] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);

  const handleAccept = () => {
    onAccept(userRedactionNotes.trim() || undefined);
    setUserRedactionNotes('');
    setShowOriginal(false);
  };

  const handleReject = () => {
    onReject();
    setUserRedactionNotes('');
    setShowOriginal(false);
  };

  const handleClose = () => {
    onClose();
    setUserRedactionNotes('');
    setShowOriginal(false);
  };

  // Count redactions
  const redactionCount = (
    deidentifiedDocument.match(/\[REDACTED[^\]]*\]/g) || []
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl w-[95vw] h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Privacy Review
            <Badge variant="secondary" className="ml-2">
              <FileText className="h-3 w-3 mr-1" />
              {fileName}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Personal information has been automatically removed from your
            document. Please review the redactions and confirm they are
            sufficient before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 min-h-0 overflow-y-auto px-1">
          {/* Redaction Summary */}
          <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-800">
                {redactionCount} personal identifiers automatically removed
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant={showOriginal ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowOriginal(!showOriginal)}
                className="text-xs"
              >
                {showOriginal ? 'Hide Original' : 'Compare with Original'}
              </Button>
            </div>
          </div>

          {/* Document Display */}
          <div className="flex-1 grid grid-cols-1 gap-4 min-h-0">
            {showOriginal ? (
              <div className="grid grid-cols-2 gap-4 h-full min-h-0">
                {/* Original Document */}
                <div className="border rounded-lg overflow-hidden flex flex-col">
                  <div className="bg-red-50 px-3 py-2 border-b flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium text-red-800">
                        Original (with personal info)
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="text-xs font-mono whitespace-pre-wrap text-gray-700">
                      {originalDocument}
                    </div>
                  </div>
                </div>

                {/* De-identified Document */}
                <div className="border rounded-lg overflow-hidden flex flex-col">
                  <div className="bg-green-50 px-3 py-2 border-b flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">
                        De-identified (safe for AI)
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3">
                    <div className="text-xs font-mono whitespace-pre-wrap">
                      {deidentifiedDocument
                        .split(/(\[REDACTED[^\]]*\])/)
                        .map((part, index) => (
                          <span key={index}>
                            {part.startsWith('[REDACTED') ? (
                              <span className="bg-yellow-200 px-1 rounded font-medium text-yellow-800">
                                {part}
                              </span>
                            ) : (
                              <span className="text-gray-700">{part}</span>
                            )}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* De-identified Document Only */
              <div className="border rounded-lg overflow-hidden flex flex-col h-full">
                <div className="bg-blue-50 px-3 py-2 border-b flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">
                      De-identified Document Preview
                    </span>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="text-sm font-mono whitespace-pre-wrap leading-relaxed">
                    {deidentifiedDocument
                      .split(/(\[REDACTED[^\]]*\])/)
                      .map((part, index) => (
                        <span key={index}>
                          {part.startsWith('[REDACTED') ? (
                            <span className="bg-yellow-200 px-1 rounded font-medium text-yellow-800">
                              {part}
                            </span>
                          ) : (
                            <span className="text-gray-700">{part}</span>
                          )}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Additional Redaction Requests */}
          <div className="space-y-2 flex-shrink-0">
            <label className="text-sm font-medium text-gray-700">
              Additional redaction requests (optional)
            </label>
            <Textarea
              value={userRedactionNotes}
              onChange={(e) => setUserRedactionNotes(e.target.value)}
              placeholder='Specify exact terms to redact (e.g., "Dr. Smith", "Methodist Hospital", "Lisinopril" or comma-separated: Memorial Clinic, insulin, cardiology)...'
              className="min-h-[60px] text-sm resize-none"
              rows={2}
            />
          </div>

          {/* Trust Messaging */}
          <div className="bg-blue-50 p-3 rounded-lg flex-shrink-0">
            <div className="flex items-start gap-3">
              <Lock className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <p className="font-medium mb-1">Privacy Protection</p>
                <p>
                  Personal information is removed before AI analysis. This extra
                  step ensures your privacy even with encrypted data
                  transmission.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-3 border-t flex-shrink-0">
            <Button
              variant="outline"
              onClick={handleReject}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel Upload
            </Button>
            <Button onClick={handleAccept} className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Accept & Continue to AI Analysis
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
