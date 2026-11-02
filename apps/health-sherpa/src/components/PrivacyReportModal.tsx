'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ShieldCheck,
  FileText,
  Eye,
  EyeOff,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Info,
  Lock,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { useDocumentState, useUIState, usePhaseState } from '@/store/hooks';

/**
 * HIPAA Safe Harbor PHI Categories
 * Based on 45 CFR 164.514(b)(2)
 */
const HIPAA_PHI_CATEGORIES = [
  {
    id: 'names',
    label: 'Names',
    description: 'Patient, family, employer names',
  },
  {
    id: 'dates',
    label: 'Dates',
    description: 'Birth, admission, discharge, death dates',
  },
  {
    id: 'phone',
    label: 'Phone Numbers',
    description: 'Telephone and fax numbers',
  },
  {
    id: 'email',
    label: 'Email Addresses',
    description: 'Electronic mail addresses',
  },
  {
    id: 'ssn',
    label: 'Social Security Numbers',
    description: 'SSN and other government IDs',
  },
  {
    id: 'mrn',
    label: 'Medical Record Numbers',
    description: 'Account and certificate numbers',
  },
  { id: 'address', label: 'Addresses', description: 'Geographic locations' },
  {
    id: 'vehicle',
    label: 'Vehicle Identifiers',
    description: 'License plates, VINs',
  },
  {
    id: 'device',
    label: 'Device Identifiers',
    description: 'Serial numbers, device IDs',
  },
  { id: 'url', label: 'Web URLs', description: 'Internet addresses' },
  {
    id: 'ip',
    label: 'IP Addresses',
    description: 'Internet protocol addresses',
  },
  {
    id: 'biometric',
    label: 'Biometric Identifiers',
    description: 'Fingerprints, voice prints',
  },
  {
    id: 'photo',
    label: 'Photographs',
    description: 'Full face and identifying photos',
  },
  {
    id: 'other',
    label: 'Other Identifiers',
    description: 'Any other unique identifying information',
  },
];

/**
 * PHI Detection patterns aligned with HIPAA Safe Harbor
 */
const PHI_DETECTION_PATTERNS = [
  { category: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, confidence: 0.95 },
  { category: 'phone', pattern: /\b\d{3}-\d{3}-\d{4}\b/g, confidence: 0.9 },
  {
    category: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    confidence: 0.95,
  },
  {
    category: 'dates',
    pattern: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
    confidence: 0.8,
  },
  { category: 'mrn', pattern: /MRN:\s*\w+/g, confidence: 0.9 },
  { category: 'dates', pattern: /DOB:\s*[^\s,\n]+/g, confidence: 0.85 },
  { category: 'names', pattern: /Patient:\s*[^\s,\n]+/g, confidence: 0.85 },
  {
    category: 'address',
    pattern:
      /\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b/g,
    confidence: 0.75,
  },
];

interface PHIDetection {
  category: string;
  text: string;
  confidence: number;
  position: number;
}

interface CategoryRedaction {
  category: string;
  terms: string[];
  enabled: boolean;
}

export function PrivacyReportModal() {
  const { activeDocument, deidentifyDocument, updateDocument } =
    useDocumentState();

  const { isPrivacyModalOpen, openPrivacyModal, closePrivacyModal } =
    useUIState();

  const { setCurrentPhase } = usePhaseState();

  // Enhanced close function with error handling
  const safeCloseModal = useCallback(() => {
    try {
      console.log('Safely closing privacy modal...');
      if (typeof closePrivacyModal !== 'function') {
        console.error(
          'closePrivacyModal is not a function:',
          typeof closePrivacyModal
        );
        return false;
      }
      closePrivacyModal();
      return true;
    } catch (error) {
      console.error('Error closing privacy modal:', error);
      return false;
    }
  }, [closePrivacyModal]);

  // Enhanced phase advancement with error handling
  const safeAdvancePhase = useCallback(
    (targetPhase: number) => {
      try {
        console.log(`Safely advancing to phase ${targetPhase}...`);
        if (typeof setCurrentPhase !== 'function') {
          console.error(
            'setCurrentPhase is not a function:',
            typeof setCurrentPhase
          );
          return false;
        }
        setCurrentPhase(targetPhase as any);
        return true;
      } catch (error) {
        console.error('Error advancing phase:', error);
        return false;
      }
    },
    [setCurrentPhase]
  );

  const [isClient, setIsClient] = useState(false);
  const [customRedactions, setCustomRedactions] = useState<string[]>([]);
  const [categoryRedactions, setCategoryRedactions] = useState<
    CategoryRedaction[]
  >(
    HIPAA_PHI_CATEGORIES.map((cat) => ({
      category: cat.id,
      terms: [],
      enabled: true,
    }))
  );
  const [newRedaction, setNewRedaction] = useState('');
  const [newRedactionCategory, setNewRedactionCategory] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [phiDetections, setPhiDetections] = useState<PHIDetection[]>([]);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Debug logging for state changes
  useEffect(() => {
    console.log('Privacy modal state changed:', {
      isPrivacyModalOpen,
      activeDocument: activeDocument?.id,
      hasSetCurrentPhaseFunction: typeof setCurrentPhase === 'function',
    });
  }, [isPrivacyModalOpen, activeDocument?.id]);

  useEffect(() => {
    // Auto-open privacy modal after document upload for trust building
    if (activeDocument && !activeDocument.deidentified && isClient) {
      console.log(
        'Auto-opening privacy modal for document:',
        activeDocument.id
      );
      openPrivacyModal();
      handleGeminiRedaction();
    }
  }, [activeDocument, isClient, openPrivacyModal]);

  /**
   * Gemini 2.0 Flash integration for HIPAA Safe Harbor redaction
   * This simulates the AI redaction process - in production this would call Gemini API
   */
  const handleGeminiRedaction = useCallback(async () => {
    if (!activeDocument) return;

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      // Simulate Gemini 2.0 Flash processing with progress
      const progressInterval = setInterval(() => {
        setProcessingProgress((prev) => Math.min(prev + 15, 90));
      }, 200);

      // Analyze document for PHI using patterns
      const detections = await analyzeDocumentForPHI(activeDocument.content);
      setPhiDetections(detections);

      // Apply HIPAA Safe Harbor redaction
      await deidentifyDocument(activeDocument.id);

      clearInterval(progressInterval);
      setProcessingProgress(100);
    } catch (error) {
      console.error('Gemini redaction failed:', error);
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(0);
      }, 500);
    }
  }, [activeDocument, deidentifyDocument]);

  /**
   * Analyze document content for PHI using detection patterns
   */
  const analyzeDocumentForPHI = useCallback(
    async (content: string): Promise<PHIDetection[]> => {
      const detections: PHIDetection[] = [];

      PHI_DETECTION_PATTERNS.forEach(({ category, pattern, confidence }) => {
        const matches = Array.from(content.matchAll(pattern));
        matches.forEach((match) => {
          if (match.index !== undefined) {
            detections.push({
              category,
              text: match[0],
              confidence,
              position: match.index,
            });
          }
        });
      });

      return detections.sort((a, b) => a.position - b.position);
    },
    []
  );

  /**
   * Add custom redaction with category
   */
  const addCustomRedaction = useCallback(() => {
    if (newRedaction.trim() && newRedactionCategory) {
      const updatedCategories = categoryRedactions.map((cat) =>
        cat.category === newRedactionCategory
          ? { ...cat, terms: [...cat.terms, newRedaction.trim()] }
          : cat
      );
      setCategoryRedactions(updatedCategories);
      setNewRedaction('');
      setNewRedactionCategory('');
    }
  }, [newRedaction, newRedactionCategory, categoryRedactions]);

  /**
   * Remove custom redaction
   */
  const removeCustomRedaction = useCallback(
    (category: string, term: string) => {
      const updatedCategories = categoryRedactions.map((cat) =>
        cat.category === category
          ? { ...cat, terms: cat.terms.filter((t) => t !== term) }
          : cat
      );
      setCategoryRedactions(updatedCategories);
    },
    [categoryRedactions]
  );

  /**
   * Apply custom redactions to document
   */
  const applyCustomRedactions = useCallback(() => {
    if (!activeDocument) return;

    let redactedContent = activeDocument.content;

    categoryRedactions.forEach(({ terms, enabled }) => {
      if (enabled) {
        terms.forEach((term) => {
          const regex = new RegExp(
            term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'gi'
          );
          redactedContent = redactedContent.replace(regex, '[REDACTED]');
        });
      }
    });

    updateDocument(activeDocument.id, {
      content: redactedContent,
      deidentified: true,
      processedAt: new Date().toISOString(),
    });
  }, [activeDocument, categoryRedactions, updateDocument]);

  /**
   * Get deidentified content with HIPAA Safe Harbor patterns
   */
  const deidentifiedContent = useMemo(() => {
    if (!activeDocument) return '';

    let content = activeDocument.content;

    // Apply HIPAA Safe Harbor patterns
    PHI_DETECTION_PATTERNS.forEach(({ pattern }) => {
      content = content.replace(pattern, '[REDACTED]');
    });

    // Apply custom category redactions
    categoryRedactions.forEach(({ terms, enabled }) => {
      if (enabled) {
        terms.forEach((term) => {
          const regex = new RegExp(
            term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            'gi'
          );
          content = content.replace(regex, '[REDACTED]');
        });
      }
    });

    return content;
  }, [activeDocument?.content, categoryRedactions]);

  // Enhanced Continue button handler with better event handling
  const handleContinueClick = useCallback(
    (event: React.MouseEvent) => {
      // Prevent event bubbling and default behavior
      event.preventDefault();
      event.stopPropagation();

      console.log('Continue button clicked');

      try {
        // Apply custom redactions if any exist
        if (categoryRedactions.some((cat) => cat.terms.length > 0)) {
          console.log('Applying custom redactions...');
          applyCustomRedactions();
        }

        // Close the modal first
        console.log('Closing privacy modal...');
        const closeSuccess = safeCloseModal();

        if (closeSuccess) {
          // Small delay to ensure modal closes before phase change
          setTimeout(() => {
            console.log('Setting current phase to 1...');
            const phaseSuccess = safeAdvancePhase(1);
            if (phaseSuccess) {
              console.log('Privacy modal workflow completed successfully');
            } else {
              console.error('Failed to advance phase');
            }
          }, 100);
        } else {
          console.error('Failed to close modal');
        }
      } catch (error) {
        console.error('Error in privacy modal workflow:', error);
      }
    },
    [
      categoryRedactions,
      applyCustomRedactions,
      safeCloseModal,
      safeAdvancePhase,
    ]
  );

  // Client-side rendering safety check
  if (!isClient) {
    return null;
  }

  return (
    <Dialog
      open={isPrivacyModalOpen}
      onOpenChange={(open) => {
        console.log('Dialog onOpenChange:', open);
        if (!open) {
          safeCloseModal();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-6xl max-w-[95vw] h-[90vh] flex flex-col overflow-hidden"
        onPointerDownOutside={(e) => {
          // Prevent clicking outside from closing modal accidentally
          e.preventDefault();
        }}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center">
            <ShieldCheck className="h-6 w-6 mr-2 text-primary" />
            HIPAA Safe Harbor De-identification
            {activeDocument?.deidentified && (
              <Badge
                variant="outline"
                className="ml-2 text-green-600 border-green-600"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Protected
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Automated redaction for HIPAA Safe Harbor. Demo mode uses sample
            redaction. Review and customize redactions below.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-4 overflow-y-auto">
          {activeDocument ? (
            <>
              {/* Processing Status */}
              {isProcessing && (
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        Processing document...
                      </p>
                      <Progress value={processingProgress} className="mt-2" />
                      <p className="text-xs text-muted-foreground mt-1">
                        Analyzing for HIPAA Safe Harbor compliance (
                        {processingProgress}%)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* PHI Detection Summary */}
              {phiDetections.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border">
                  <h3 className="font-semibold text-sm mb-3 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                    {phiDetections.length} PHI Items Detected & Protected
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(
                      new Set(phiDetections.map((d) => d.category))
                    ).map((category) => {
                      const count = phiDetections.filter(
                        (d) => d.category === category
                      ).length;
                      const catInfo = HIPAA_PHI_CATEGORIES.find(
                        (c) => c.id === category
                      );
                      return (
                        <Badge
                          key={category}
                          variant="outline"
                          className="text-xs border-green-600 text-green-700"
                        >
                          {catInfo?.label || category} ({count})
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Privacy Controls */}
              <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center">
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Privacy Controls
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAdvancedControls(!showAdvancedControls);
                    }}
                    className="text-xs"
                  >
                    {showAdvancedControls ? (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Less
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3 w-3 mr-1" />
                        Advanced
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-3">
                  {/* View Toggle */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Document View:</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowOriginal(!showOriginal);
                      }}
                      className="flex items-center gap-2"
                    >
                      {showOriginal ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          Hide Original
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          View Original
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Custom Redactions */}
                  {showAdvancedControls && (
                    <div className="space-y-3">
                      <Label className="text-sm block">
                        Add Custom Redactions:
                      </Label>

                      <div className="flex gap-2">
                        <select
                          value={newRedactionCategory}
                          onChange={(e) =>
                            setNewRedactionCategory(e.target.value)
                          }
                          className="px-3 py-2 border rounded-md text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="">Select Category</option>
                          {HIPAA_PHI_CATEGORIES.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                        <Input
                          placeholder="Enter text to redact"
                          value={newRedaction}
                          onChange={(e) => setNewRedaction(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              addCustomRedaction();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            addCustomRedaction();
                          }}
                          disabled={
                            !newRedaction.trim() || !newRedactionCategory
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Custom Redaction List */}
                      {categoryRedactions.some(
                        (cat) => cat.terms.length > 0
                      ) && (
                        <div className="space-y-2">
                          <Label className="text-sm">
                            Custom Redactions by Category:
                          </Label>
                          {categoryRedactions
                            .filter((cat) => cat.terms.length > 0)
                            .map((cat) => {
                              const catInfo = HIPAA_PHI_CATEGORIES.find(
                                (c) => c.id === cat.category
                              );
                              return (
                                <div
                                  key={cat.category}
                                  className="border rounded p-3 bg-white dark:bg-gray-800"
                                >
                                  <h4 className="font-medium text-sm mb-2">
                                    {catInfo?.label}
                                  </h4>
                                  <div className="flex flex-wrap gap-1">
                                    {cat.terms.map((term, index) => (
                                      <Badge
                                        key={index}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {term}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-auto p-0 ml-1"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeCustomRedaction(
                                              cat.category,
                                              term
                                            );
                                          }}
                                        >
                                          <X className="h-2 w-2" />
                                        </Button>
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Document Content */}
              <div className="flex-1 min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-semibold flex items-center">
                    <FileText className="h-4 w-4 mr-2" />
                    {showOriginal
                      ? 'Original Document'
                      : 'De-identified Document'}
                    : {activeDocument.filename}
                  </h3>
                  {showOriginal && (
                    <div className="flex items-center text-amber-600 text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Contains PHI
                    </div>
                  )}
                </div>

                <ScrollArea className="h-[400px] w-full border rounded-md bg-secondary/30 p-4">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                    {isProcessing ? (
                      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground space-y-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <div className="text-center space-y-2">
                          <p className="font-medium">
                            Processing document...
                          </p>
                          <Progress
                            value={processingProgress}
                            className="w-64"
                          />
                          <p className="text-xs text-muted-foreground">
                            {processingProgress}% complete
                          </p>
                        </div>
                      </div>
                    ) : showOriginal ? (
                      activeDocument.content
                    ) : (
                      deidentifiedContent
                    )}
                  </pre>
                </ScrollArea>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8 border rounded-md bg-muted text-muted-foreground">
                <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">
                  No Document Processed
                </p>
                <p className="text-sm">
                  Upload a document to generate a HIPAA Safe Harbor
                  de-identification.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 mt-4 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              safeCloseModal();
            }}
          >
            Close
          </Button>
          {activeDocument && (
            <Button onClick={handleContinueClick} className="relative z-50">
              Continue with Protected Document
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export a small trigger button component for use next to document names
export function PrivacyReportTrigger({
  className = '',
}: {
  className?: string;
}) {
  const { openPrivacyModal } = useUIState();
  const { activeDocument } = useDocumentState();

  if (!activeDocument) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-6 px-2 text-xs ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        openPrivacyModal();
      }}
    >
      <ShieldCheck className="h-3 w-3 mr-1" />
      Privacy Report
    </Button>
  );
}
