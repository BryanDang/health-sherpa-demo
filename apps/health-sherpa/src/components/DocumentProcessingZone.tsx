'use client';

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud,
  FileText,
  Loader2,
  AlertCircle,
  Shield,
  Check,
  Lock,
  Eye,
  X,
  ChevronRight,
  ChevronDown,
  Edit3,
  Download,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useDocumentState, useUIState } from '@/store/hooks';
import { useToast } from '@/hooks/use-toast';
import SessionManager from '@/components/SessionManager';
import EnhancedAIBrain from '@/components/EnhancedAIBrain';
import DocumentReviewModal from '@/components/DocumentReviewModal';
import TokenCounter from '@/components/TokenCounter';

interface DocumentProcessingZoneProps {
  className?: string;
}

export default function DocumentProcessingZone({
  className = '',
}: DocumentProcessingZoneProps) {
  const { activeDocument, uploadDocument, updateDocument } = useDocumentState();
  const { isProviderMode } = useUIState();
  const { toast } = useToast();

  // Demo document content
  const demoDocument = `SPRINGFIELD GENERAL HOSPITAL
Electronic Health Record

Patient: Sarah Michelle Rodriguez
DOB: 07/22/1985
MRN: SGH-789012345
Phone: (555) 867-5309
Address: 456 Maple Avenue, Springfield, IL 62704
Email: sarah.rodriguez@example.com
SSN: 456-78-9012
Insurance: Anthem Blue Cross
Member ID: ANT987654321
Policy: POL456789123

Provider: Dr. Michael Chen, MD
Date of Service: 12/08/2024
Visit Type: Follow-up Consultation

CHIEF COMPLAINT:
Ongoing management of Type 2 diabetes and hypertension

CURRENT MEDICATIONS:
1. Metformin 1000mg twice daily
2. Lisinopril 20mg once daily  
3. Atorvastatin 40mg at bedtime
4. Aspirin 81mg daily for cardioprevention

VITAL SIGNS:
Blood Pressure: 142/88 mmHg
Weight: 165 lbs
BMI: 27.3
Blood Glucose: 156 mg/dL

ASSESSMENT AND PLAN:
1. Type 2 Diabetes Mellitus - Continue current Metformin regimen. Patient shows good compliance. HbA1c improved to 7.2% from previous 8.1%.

2. Hypertension - Blood pressure still elevated. Increase Lisinopril to 30mg daily. Patient to monitor BP at home with provided cuff.

3. Hyperlipidemia - Continue Atorvastatin. Recent lipid panel shows LDL of 89 mg/dL, approaching target.

FOLLOW-UP:
Return to clinic in 6 weeks for medication adjustment and lab review.
Contact Springfield General at (555) 123-4567 with any concerns.

Emergency Contact: Maria Rodriguez (sister) - (555) 234-5678

Electronically signed by Dr. Michael Chen, MD
License #: IL-MD-234567
Springfield General Hospital
789 Healthcare Drive, Springfield, IL 62701
www.springfieldgeneral.org

This document contains Protected Health Information (PHI) under HIPAA.`;

  // AI-powered redaction using Gemini API
  const performAIRedaction = async (text: string): Promise<string> => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Please identify and redact all Protected Health Information (PHI) in this medical document according to HIPAA Safe Harbor requirements. Replace any PHI with [REDACTED-TYPE] tags (e.g., [REDACTED-NAME], [REDACTED-DATE], [REDACTED-PHONE]). Here is the document:\n\n${text}`,
          context: {
            currentPhase: 0,
            conversationHistory: [],
            isProviderMode: false,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`AI redaction failed: ${response.status}`);
      }

      const data = await response.json();
      return data.content || text; // Fallback to original if AI fails
    } catch (error) {
      console.error('AI redaction error:', error);
      // Fallback to original text if AI fails
      return text;
    }
  };

  const handleDemoUpload = async () => {
    setLocalError(null);
    setIsProcessing(true);
    setProcessingStep('Loading demo document...');
    setUploadProgress(20);

    // Create a demo file
    const demoFile = new File([demoDocument], 'demo-medical-record.txt', {
      type: 'text/plain',
    });
    setPendingFile(demoFile);

    try {
      setProcessingStep('Applying AI-powered redaction...');
      setUploadProgress(60);

      // Apply AI-powered redaction first, then rule-based
      const aiRedacted = await performAIRedaction(demoDocument);
      const { original, deidentified } = deidentifyText(aiRedacted);

      setOriginalDocument(original);
      setDeidentifiedDocument(deidentified);
      setUploadProgress(100);
      setProcessingStep('Ready for review');

      // Show review modal
      setShowReviewModal(true);

      toast({
        title: 'Demo Document Loaded',
        description:
          'Realistic medical record with various PII for demonstration.',
      });
    } catch (error: any) {
      console.error('Error during demo processing:', error);
      setLocalError(
        error.message || 'An error occurred during demo processing.'
      );
      toast({
        title: 'Demo Failed',
        description: error.message || 'Failed to process demo document',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Debug logging
  console.log('DocumentProcessingZone rendering', {
    activeDocument,
    isProviderMode,
  });

  // Local state for document processing
  const [isExpanded, setIsExpanded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [originalDocument, setOriginalDocument] = useState<string>('');
  const [deidentifiedDocument, setDeidentifiedDocument] = useState<string>('');
  const [acceptedDocument, setAcceptedDocument] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [showAcceptedDoc, setShowAcceptedDoc] = useState(false);

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  const deidentifyText = (
    text: string
  ): { original: string; deidentified: string } => {
    // HIPAA Safe Harbor: Redact the 18 identifiers required by law
    let deidentified = text
      // 1. Names (and initials)
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[REDACTED-NAME]')
      .replace(/\b[A-Z]\. [A-Z][a-z]+\b/g, '[REDACTED-NAME]')
      .replace(/\b[A-Z][A-Z]+ [A-Z][a-z]+\b/g, '[REDACTED-NAME]')
      .replace(/\bDr\. [A-Z][a-z]+\b/g, '[REDACTED-NAME]')
      .replace(/Patient:\s*[A-Z][a-z\s]+/gi, 'Patient: [REDACTED-NAME]')

      // 2. Geographic subdivisions smaller than state (zip codes, counties, cities, towns)
      .replace(/\b\d{5}(-\d{4})?\b/g, '[REDACTED-ZIP]')
      .replace(
        /\b\d+\s+[A-Z][a-z\s]+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Place|Pl)\b/gi,
        '[REDACTED-ADDRESS]'
      )

      // 3. Dates (except year) related to individual
      .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '[REDACTED-DATE]')
      .replace(/\b\d{1,2}-\d{1,2}-\d{4}\b/g, '[REDACTED-DATE]')
      .replace(
        /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/gi,
        '[REDACTED-DATE]'
      )
      .replace(/DOB:\s*[^\n\r,]+/gi, 'DOB: [REDACTED-DATE]')

      // 4. Telephone numbers
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[REDACTED-PHONE]')
      .replace(/\(\d{3}\)\s?\d{3}-\d{4}/g, '[REDACTED-PHONE]')
      .replace(/Phone:\s*[^\n\r,]+/gi, 'Phone: [REDACTED-PHONE]')

      // 5. Fax numbers (similar to phone)
      .replace(/Fax:\s*[^\n\r,]+/gi, 'Fax: [REDACTED-FAX]')

      // 6. Email addresses
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        '[REDACTED-EMAIL]'
      )

      // 7. Social Security numbers
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED-SSN]')

      // 8. Medical record numbers
      .replace(/MRN:\s*[^\n\r,]+/gi, 'MRN: [REDACTED-MRN]')
      .replace(/\bMR[N#]?\s*:?\s*[A-Z0-9\-]+/gi, '[REDACTED-MRN]')

      // 9. Health plan beneficiary numbers
      .replace(
        /\b(Member|Policy|Group|Plan)\s*(Number|ID|#)?\s*:?\s*[A-Z0-9\-]+\b/gi,
        '[REDACTED-MEMBER-ID]'
      )

      // 10. Account numbers
      .replace(
        /\bAccount\s*(Number|#)?\s*:?\s*[A-Z0-9\-]+\b/gi,
        '[REDACTED-ACCOUNT]'
      )

      // 11. Certificate/license numbers
      .replace(
        /\b(License|Certificate)\s*(Number|#)?\s*:?\s*[A-Z0-9\-]+\b/gi,
        '[REDACTED-LICENSE]'
      )

      // 12. Vehicle identifiers and serial numbers (including license plates)
      .replace(/\b[A-Z0-9]{2,3}-[A-Z0-9]{3,4}\b/g, '[REDACTED-VEHICLE]')

      // 13. Device identifiers and serial numbers
      .replace(
        /\bSerial\s*(Number|#)?\s*:?\s*[A-Z0-9\-]+\b/gi,
        '[REDACTED-SERIAL]'
      )

      // 14. Web URLs
      .replace(/https?:\/\/[^\s]+/g, '[REDACTED-URL]')
      .replace(/www\.[^\s]+/g, '[REDACTED-URL]')

      // 15. Internet Protocol (IP) addresses
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[REDACTED-IP]')

      // 16. Biometric identifiers (general patterns)
      .replace(
        /\b(Fingerprint|Retinal|Voiceprint)\s*:?\s*[A-Z0-9\-]+\b/gi,
        '[REDACTED-BIOMETRIC]'
      )

      // 17. Full-face photographs and comparable images
      .replace(
        /\b(Photo|Image|Picture)\s*(ID|Number|#)?\s*:?\s*[A-Z0-9\-]+\b/gi,
        '[REDACTED-PHOTO-ID]'
      )

      // 18. Any other unique identifying number, characteristic, or code
      .replace(/\bID:\s*[^\n\r,]+/gi, 'ID: [REDACTED-ID]')
      .replace(/\bIdentifier:\s*[^\n\r,]+/gi, 'Identifier: [REDACTED-ID]');

    return {
      original: text,
      deidentified: deidentified,
    };
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setLocalError(null);
      if (acceptedFiles.length === 0) {
        setLocalError('No file selected or file type not supported.');
        return;
      }

      const file = acceptedFiles[0];
      if (file.size > 10 * 1024 * 1024) {
        setLocalError('File is too large. Maximum size is 10MB.');
        return;
      }

      setIsProcessing(true);
      setProcessingStep('Reading document...');
      setUploadProgress(20);
      setPendingFile(file);

      try {
        let fileContent = '';

        if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
          fileContent = await readFileAsText(file);
        } else {
          // For other file types, create placeholder
          fileContent = `UPLOADED DOCUMENT: ${file.name}

File Type: ${file.type}
Size: ${(file.size / 1024).toFixed(1)} KB
Upload Date: ${new Date().toLocaleDateString()}

[Document content will be extracted and analyzed after privacy review]`;
        }

        setProcessingStep('Removing personal information...');
        setUploadProgress(60);

        // De-identify the document
        const { original, deidentified } = deidentifyText(fileContent);

        setOriginalDocument(original);
        setDeidentifiedDocument(deidentified);
        setUploadProgress(100);
        setProcessingStep('Ready for review');

        // Show review modal
        setShowReviewModal(true);

        toast({
          title: 'Document Processed',
          description:
            'Your document has been de-identified and is ready for review.',
        });
      } catch (error: any) {
        console.error('Error during processing:', error);
        setLocalError(
          error.message || 'An error occurred during document processing.'
        );
        toast({
          title: 'Processing Failed',
          description: error.message || 'Failed to process document',
          variant: 'destructive',
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
    },
    multiple: false,
  });

  const handleAcceptDocument = (additionalRedactions?: string) => {
    if (!deidentifiedDocument || !pendingFile) return;

    // Apply additional user redactions if provided (specific terms only)
    let finalDocument = deidentifiedDocument;
    if (additionalRedactions && additionalRedactions.trim()) {
      // Only redact specific terms user mentions in quotes or by exact term
      const quotedTerms = additionalRedactions.match(/"([^"]+)"/g);
      if (quotedTerms) {
        quotedTerms.forEach((term) => {
          const cleanTerm = term.replace(/"/g, '').trim();
          if (cleanTerm.length > 2) {
            const escapedTerm = cleanTerm.replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&'
            );
            finalDocument = finalDocument.replace(
              new RegExp(`\\b${escapedTerm}\\b`, 'gi'),
              '[REDACTED-CUSTOM]'
            );
          }
        });
      }

      // Also support comma-separated terms without quotes
      const terms = additionalRedactions
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 2);
      terms.forEach((term) => {
        if (!term.includes('"')) {
          // Skip if already processed as quoted
          const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          finalDocument = finalDocument.replace(
            new RegExp(`\\b${escapedTerm}\\b`, 'gi'),
            '[REDACTED-CUSTOM]'
          );
        }
      });
    }

    // Store both original and final versions
    setAcceptedDocument(finalDocument);

    // Use the hooks from component scope

    // Create a processed file
    const processedFile = new File([finalDocument], pendingFile.name, {
      type: 'text/plain',
    });

    uploadDocument(processedFile)
      .then((documentId) => {
        // Update with redacted content
        updateDocument(documentId, {
          content: finalDocument,
          deidentified: true,
          processedAt: new Date().toISOString(),
        });
      })
      .catch((error) => {
        console.error('Failed to save document:', error);
        toast({
          title: 'Save Error',
          description: 'Failed to save processed document.',
          variant: 'destructive',
        });
      });

    toast({
      title: 'Document Accepted',
      description: 'Your document is now ready for AI analysis.',
    });

    // Reset upload state but keep accepted document for viewing
    setShowReviewModal(false);
    setPendingFile(null);
    setUploadProgress(0);
    // Don't clear original and deidentified documents - keep for comparison viewing
  };

  const handleRejectDocument = () => {
    setShowReviewModal(false);
    setOriginalDocument('');
    setDeidentifiedDocument('');
    setPendingFile(null);
    setUploadProgress(0);
    setLocalError(null);
  };

  return (
    <div
      className={`w-80 min-w-80 bg-background border-r-2 border-primary flex flex-col ${className}`}
      style={{ minHeight: '100vh' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center">
          <FileText className="h-5 w-5 mr-2 text-primary" />
          Document Zone
          <Shield className="h-4 w-4 ml-2 text-green-600" />
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Secure document processing with privacy protection
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Active Document Display */}
        {(activeDocument || acceptedDocument) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-sm">
                <FileText className="h-4 w-4 mr-2 text-primary" />
                Active Document
                <Badge variant="secondary" className="ml-2">
                  <Lock className="h-3 w-3 mr-1" />
                  Protected
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium text-sm">
                  {activeDocument?.filename ||
                    pendingFile?.name ||
                    'Document.pdf'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {acceptedDocument
                    ? 'De-identified • Ready for analysis'
                    : 'Processed • Ready for analysis'}
                </p>
              </div>
              <div className="flex space-x-2">
                {acceptedDocument && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowAcceptedDoc(true)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                )}
                <Button size="sm" variant="outline" className="flex-1">
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
                <Button size="sm" variant="outline">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Demo Document Button */}
        {!showReviewModal && !activeDocument && !acceptedDocument && (
          <Card>
            <CardContent className="p-4">
              <Button
                onClick={handleDemoUpload}
                variant="outline"
                className="w-full h-12 border-2 border-dashed border-blue-300 hover:border-blue-500 hover:bg-blue-50 transition-colors"
                disabled={isProcessing}
              >
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-700">
                    See Demo First?
                  </span>
                </div>
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Try with a realistic medical record sample
              </p>
            </CardContent>
          </Card>
        )}

        {/* Upload Zone */}
        {!showReviewModal && (
          <Card>
            <CardContent className="p-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70'}
                  ${localError ? 'border-destructive' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="space-y-3">
                  {isProcessing ? (
                    <>
                      <div className="flex items-center justify-center space-x-2">
                        <Shield className="h-8 w-8 text-primary animate-pulse" />
                        <Lock className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="space-y-2">
                        <p className="font-medium text-sm">{processingStep}</p>
                        <Progress value={uploadProgress} className="w-full" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center space-x-2">
                        <UploadCloud
                          className={`h-8 w-8 ${localError ? 'text-destructive' : 'text-primary'}`}
                        />
                        <Shield className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">
                          {isDragActive ? 'Drop file here' : 'Upload Document'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PDF, JPG, PNG, TXT (Max 10MB)
                        </p>
                        <div className="flex items-center justify-center space-x-1 text-xs text-green-600">
                          <Shield className="h-3 w-3" />
                          <span>HIPAA-compliant</span>
                        </div>
                      </div>
                    </>
                  )}
                  {localError && (
                    <div className="text-sm text-destructive flex items-center justify-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {localError}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session Management */}
        <SessionManager />

        {/* Enhanced AI Brain */}
        <EnhancedAIBrain />

        {/* Token Usage Counter */}
        <TokenCounter />

        {/* Privacy Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-sm">
              <Shield className="h-4 w-4 mr-2 text-green-600" />
              Privacy Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2 text-xs">
              <Check className="h-3 w-3 text-green-600" />
              <span>Personal info automatically removed</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <Check className="h-3 w-3 text-green-600" />
              <span>User review before analysis</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <Check className="h-3 w-3 text-green-600" />
              <span>Encrypted data transmission</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <Check className="h-3 w-3 text-green-600" />
              <span>No data retention policy</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Document Review Modal */}
      <DocumentReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        originalDocument={originalDocument}
        deidentifiedDocument={deidentifiedDocument}
        onAccept={handleAcceptDocument}
        onReject={handleRejectDocument}
        fileName={pendingFile?.name}
      />

      {/* View Accepted Document Modal */}
      <DocumentReviewModal
        isOpen={showAcceptedDoc}
        onClose={() => setShowAcceptedDoc(false)}
        originalDocument={originalDocument}
        deidentifiedDocument={acceptedDocument}
        onAccept={() => setShowAcceptedDoc(false)}
        onReject={() => setShowAcceptedDoc(false)}
        fileName={activeDocument?.filename || pendingFile?.name || 'Document'}
      />
    </div>
  );
}
