// src/components/DocumentUpload.tsx
// Adapted for modular store structure
// Interacts with: MainLayout.tsx, phase engines

'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud,
  FileText,
  Loader2,
  AlertCircle,
  Shield,
  Check,
  Lock,
  X,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDocumentState, useUIState } from '@/store/hooks';
import { useToast } from '@/hooks/use-toast';

export function DocumentUpload() {
  const {
    activeDocument,
    isUploading,
    uploadProgress,
    error,
    uploadDocument,
    removeDocument,
    setError,
    clearActiveDocument,
  } = useDocumentState();

  const { isProviderMode } = useUIState();
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        setError('No file selected or file type not supported.');
        return;
      }

      const file = acceptedFiles[0];

      if (file.size > 10 * 1024 * 1024) {
        const errorMessage = 'File is too large. Maximum size is 10MB.';
        setError(errorMessage);
        toast({
          title: 'Upload Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      try {
        await uploadDocument(file);
        setIsExpanded(false);
        toast({
          title: 'Document Uploaded',
          description: `${file.name} has been uploaded successfully.`,
        });
      } catch (error) {
        console.error('Upload failed:', error);
        toast({
          title: 'Upload Failed',
          description:
            error instanceof Error
              ? error.message
              : 'Failed to upload document',
          variant: 'destructive',
        });
      }
    },
    [uploadDocument, setError, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        ['.docx'],
    },
    multiple: false,
  });

  const handleRemoveDocument = () => {
    if (activeDocument) {
      removeDocument(activeDocument.id);
      clearActiveDocument();
      toast({
        title: 'Document Removed',
        description: 'The document has been removed from your session.',
      });
    }
  };

  const handleDemoClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Create a demo file
    const demoContent = `LABORATORY REPORT - DEMO SAMPLE

Patient: [REDACTED]
DOB: [REDACTED]
MRN: [REDACTED]
Phone: [REDACTED]

Provider: [REDACTED]
Facility: Springfield Medical Center
Date of Service: [REDACTED]

LIPID PANEL RESULTS:
- Total Cholesterol: 220 mg/dL (Reference: <200)
- LDL Cholesterol: 145 mg/dL (H) (Reference: <100)
- HDL Cholesterol: 52 mg/dL (Reference: >40)
- Triglycerides: 115 mg/dL (Reference: <150)

ADDITIONAL TESTS:
- Vitamin D, 25-OH: 18 ng/mL (L) (Reference: 30-50)
- Fasting Glucose: 92 mg/dL (Reference: 70-99)
- Hemoglobin A1C: 5.4% (Reference: <5.7%)

NOTES:
Patient reports family history of cardiovascular disease.
Recommend dietary consultation and follow-up in 3 months.`;

    const demoFile = new File([demoContent], 'Demo_Lab_Results.txt', {
      type: 'text/plain',
    });
    uploadDocument(demoFile)
      .then(() => {
        setIsExpanded(false);
        toast({
          title: 'Demo Loaded',
          description: 'Sample lab results are ready to explore.',
        });
      })
      .catch((error) => {
        console.error('Demo upload failed:', error);
        toast({
          title: 'Demo Failed',
          description: 'Failed to load demo document',
          variant: 'destructive',
        });
      });
  };

  // A document is already uploaded: show compact status.
  if (activeDocument && !isUploading) {
    return (
      <div className="mt-4 space-y-3">
        {/* Document Status */}
        <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-1">
            <FileText className="h-4 w-4 text-primary" />
            <Shield className="h-3 w-3 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs truncate">
              {activeDocument.filename}
            </p>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <Lock className="h-2 w-2" />
              <span>Processed</span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRemoveDocument}
            className="h-6 w-6 p-0"
            title="Remove document"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Document Content Preview */}
        <div className="border rounded-lg">
          <div className="p-3 border-b bg-gray-50">
            <h4 className="text-sm font-medium">Document Content</h4>
            <p className="text-xs text-muted-foreground">Ready for analysis</p>
          </div>
          <div className="p-3">
            <div className="max-h-32 overflow-y-auto text-xs font-mono bg-gray-50 p-2 rounded border text-gray-700">
              {activeDocument.content || 'Document content not available'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {!isExpanded ? (
        /* Collapsed State */
        <div
          onClick={() => setIsExpanded(true)}
          className="p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition-all duration-200 hover:border-primary/50 hover:bg-gray-50"
          data-testid="upload-trigger"
        >
          <div className="flex flex-col items-center justify-center space-y-2 text-center">
            <div className="relative">
              <FileText className="h-6 w-6 text-primary" />
              <Shield
                className="h-3 w-3 text-green-600 absolute -top-0.5 -right-0.5"
                strokeWidth={2.5}
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-medium text-sm">Document Upload</h3>
              <div className="text-xs text-green-600 space-y-1">
                <p className="font-semibold">Your data stays private</p>
                <p>Encrypted and processed securely</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Expanded State */
        <div className="bg-card border rounded-lg shadow-lg">
          <div className="flex items-center justify-between p-3 border-b">
            <h3 className="font-semibold text-sm">Upload Your Document</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4">
            {isUploading ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-primary animate-pulse" />
                  <Lock className="h-4 w-4 text-green-600" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium text-primary">
                    Processing Your Document
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Uploading and preparing for analysis...
                  </p>
                </div>

                <div className="w-full space-y-2">
                  <Progress value={uploadProgress} className="w-full h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {uploadProgress < 50
                      ? 'Uploading...'
                      : uploadProgress < 100
                        ? 'Processing...'
                        : 'Complete!'}
                  </p>
                </div>

                {uploadProgress === 100 && (
                  <div className="text-center">
                    <p className="text-xs text-green-600 font-medium flex items-center justify-center space-x-1">
                      <Check className="h-3 w-3" />
                      <span>Document ready for analysis</span>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors min-h-[200px] flex flex-col items-center justify-center
                  ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/70'}
                  ${error ? 'border-destructive' : ''}`}
                data-testid="upload-dropzone"
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center space-y-3 text-center max-w-full">
                  {isDragActive ? (
                    <>
                      <UploadCloud className="h-8 w-8 text-primary" />
                      <p className="text-sm font-medium">
                        Drop your file here...
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="relative mb-2">
                        <UploadCloud className="h-8 w-8 text-primary/80" />
                      </div>
                      <div className="space-y-2 max-w-full">
                        <p className="text-base font-medium">
                          Click or drag your health docs
                        </p>
                        <p className="text-xs text-muted-foreground px-2">
                          PDF, JPG, PNG, TXT, MD, DOCX (Max 10MB)
                        </p>
                        <div className="text-xs text-green-600 mt-2 px-2 space-y-1">
                          <p className="font-semibold">
                            Your data stays private
                          </p>
                          <p>Processed securely for analysis</p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border/50 w-full">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDemoClick}
                            className="text-xs px-3 py-2 h-8 w-full max-w-[180px]"
                          >
                            Try Demo Lab Results
                          </Button>
                        </div>
                      </div>
                    </>
                  )}
                  {error && (
                    <div className="mt-2 text-xs text-destructive flex items-center px-2">
                      <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="break-words">{error}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
