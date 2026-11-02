'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Brain,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ProgressiveDisclosure from '@/components/ui/ProgressiveDisclosure';

/**
 * ReasoningDisplay Component
 * Displays AI reasoning steps, confidence scores, and clinical observations
 * Based on medical UI research and clinical decision support patterns
 */

export interface ReasoningDisplayProps {
  /** Core reasoning data */
  reasoning: {
    plan: string;
    steps: string[];
    observations: string[];
    confidence: number; // 0.0 to 1.0
    evidence?: Array<{ title: string; url?: string }>;
  };

  /** Clinical context */
  severity?: 'emergency' | 'urgent' | 'routine';
  careLevel?: 'emergency' | 'urgent' | 'primary' | 'self_care';
  emergencyFlags?: string[];

  /** Display configuration */
  expandable?: boolean;
  showConfidence?: boolean;
  showEvidence?: boolean;
  compact?: boolean;

  /** Medical role-based display */
  userRole?: 'physician' | 'nurse' | 'patient' | 'admin';

  /** Accessibility configuration */
  announceChanges?: boolean;
  emergencyOverride?: boolean;

  /** Event handlers */
  onExpand?: () => void;
  onConfidenceAlert?: (level: string) => void;
  onEmergencyFlag?: (flags: string[]) => void;
  onClinicalReview?: (reasoning: any) => void;
}

export function ReasoningDisplay({
  reasoning,
  severity = 'routine',
  careLevel,
  emergencyFlags = [],
  expandable = false,
  showConfidence = true,
  showEvidence = true,
  compact = false,
  userRole = 'patient',
  announceChanges = false,
  emergencyOverride = false,
  onExpand,
  onConfidenceAlert,
  onEmergencyFlag,
  onClinicalReview,
}: ReasoningDisplayProps) {
  // Ensure severity is properly typed
  const severityLevel: 'emergency' | 'urgent' | 'routine' = severity;
  const [isExpanded, setIsExpanded] = useState(
    emergencyOverride || severityLevel === 'emergency'
  );
  const announceRef = useRef<HTMLDivElement>(null);

  // Handle missing or malformed reasoning data
  if (!reasoning) {
    return (
      <div className="text-gray-500 italic p-4" data-testid="reasoning-display">
        No reasoning data available
      </div>
    );
  }

  if (
    !reasoning.plan ||
    !Array.isArray(reasoning.steps) ||
    !Array.isArray(reasoning.observations)
  ) {
    return (
      <div
        className="text-red-600 p-4"
        data-testid="reasoning-display"
        role="alert"
      >
        Invalid reasoning data
      </div>
    );
  }

  // Determine confidence level and color coding
  const getConfidenceLevel = (confidence: number) => {
    if (confidence >= 0.8)
      return { level: 'high', color: 'green', class: 'confidence-high' };
    if (confidence >= 0.5)
      return { level: 'medium', color: 'amber', class: 'confidence-medium' };
    return { level: 'low', color: 'red', class: 'confidence-low' };
  };

  const confidenceInfo = getConfidenceLevel(reasoning.confidence);

  // Handle confidence alerts
  useEffect(() => {
    if (confidenceInfo.level === 'low' && onConfidenceAlert) {
      onConfidenceAlert('low');
    }
  }, [confidenceInfo.level, onConfidenceAlert]);

  // Handle emergency flags
  useEffect(() => {
    if (emergencyFlags.length > 0 && onEmergencyFlag) {
      onEmergencyFlag(emergencyFlags);
    }
  }, [emergencyFlags, onEmergencyFlag]);

  // Handle expansion
  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    if (onExpand) {
      onExpand();
    }
  }, [onExpand]);

  // Role-based content filtering
  const getDisplayContent = () => {
    switch (userRole) {
      case 'patient':
        return {
          showConfidence: false,
          showDetailed: false,
          simplified: true,
        };
      case 'nurse':
        return {
          showConfidence: true,
          showDetailed: true,
          simplified: false,
        };
      case 'physician':
        return {
          showConfidence: true,
          showDetailed: true,
          simplified: false,
        };
      default:
        return {
          showConfidence: showConfidence,
          showDetailed: true,
          simplified: false,
        };
    }
  };

  const displayConfig = getDisplayContent();

  // Render confidence indicator
  const renderConfidenceIndicator = () => {
    if (!displayConfig.showConfidence) return null;

    return (
      <div
        className={cn(
          'flex items-center space-x-2 p-2 rounded-lg shadow-sm border',
          'motion-safe:transition-all motion-safe:duration-200',
          'contrast-more:border-2',
          confidenceInfo.class,
          confidenceInfo.color === 'green' && 'bg-green-50 border-green-200',
          confidenceInfo.color === 'amber' && 'bg-amber-50 border-amber-200',
          confidenceInfo.color === 'red' && 'bg-red-50 border-red-200'
        )}
        data-testid="confidence-indicator"
        data-color={confidenceInfo.color}
        role="status"
        aria-label={`Confidence level: ${Math.round(reasoning.confidence * 100)}%`}
      >
        <div
          className={cn(
            'w-3 h-3 rounded-full',
            confidenceInfo.color === 'green' && 'bg-green-500',
            confidenceInfo.color === 'amber' && 'bg-amber-500',
            confidenceInfo.color === 'red' && 'bg-red-500'
          )}
        />
        <span className="text-sm font-medium">
          Confidence: {Math.round(reasoning.confidence * 100)}%
        </span>
        {confidenceInfo.level === 'low' && (
          <AlertTriangle className="w-4 h-4 text-red-500" />
        )}
      </div>
    );
  };

  // Render emergency flags
  const renderEmergencyFlags = () => {
    if (emergencyFlags.length === 0) return null;

    return (
      <div className="space-y-2" role="alert">
        <h4 className="text-sm font-medium text-red-800">Emergency Flags:</h4>
        <div className="flex flex-wrap gap-2">
          {emergencyFlags.map((flag, index) => (
            <Badge
              key={index}
              className="emergency-flag bg-red-600 text-white"
              data-testid={`emergency-flag-${index}`}
            >
              {flag}
            </Badge>
          ))}
        </div>
      </div>
    );
  };

  // Render reasoning steps
  const renderReasoningSteps = () => {
    if (compact || displayConfig.simplified) {
      return (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-800">
            Assessment Plan:
          </h4>
          <p className="text-sm text-gray-600">{reasoning.plan}</p>
        </div>
      );
    }

    return (
      <div
        className="space-y-3"
        data-testid={isExpanded ? 'expanded-reasoning' : 'collapsed-reasoning'}
      >
        <div>
          <h4
            className="text-sm font-medium text-gray-800 mb-2"
            id="reasoning-plan"
          >
            Assessment Plan:
          </h4>
          <p className="text-sm text-gray-600" aria-labelledby="reasoning-plan">
            {reasoning.plan}
          </p>
        </div>

        <div>
          <h4
            className="text-sm font-medium text-gray-800 mb-2"
            id="reasoning-steps"
          >
            Reasoning Steps:
          </h4>
          <ul className="space-y-1" aria-labelledby="reasoning-steps">
            {reasoning.steps.map((step, index) => (
              <li
                key={index}
                className="flex items-start space-x-2 text-sm text-gray-600"
              >
                <span className="text-blue-500 font-medium">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4
            className="text-sm font-medium text-gray-800 mb-2"
            id="clinical-observations"
          >
            Clinical Observations:
          </h4>
          <ul
            className="space-y-1"
            aria-labelledby="clinical-observations"
            data-testid="detailed-observations"
          >
            {reasoning.observations.map((observation, index) => (
              <li
                key={index}
                className="flex items-start space-x-2 text-sm text-gray-600"
              >
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                <span>{observation}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  // Render evidence section
  const renderEvidence = () => {
    if (!showEvidence || !reasoning.evidence || reasoning.evidence.length === 0)
      return null;

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-800">
          Supporting Evidence:
        </h4>
        <div className="space-y-1">
          {reasoning.evidence.map((evidence, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              {evidence.url ? (
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline flex items-center space-x-1"
                  title={evidence.title}
                >
                  <span>{evidence.title}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="text-gray-600">{evidence.title}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render patient-friendly simplified view
  const renderSimplifiedView = () => (
    <div className="space-y-3" data-testid="simplified-summary">
      <div>
        <h4 className="text-sm font-medium text-gray-800 mb-2">
          Assessment Summary:
        </h4>
        <p className="text-sm text-gray-600">{reasoning.plan}</p>
      </div>
      {emergencyFlags.length > 0 && renderEmergencyFlags()}
    </div>
  );

  // Render nursing-focused view
  const renderNursingView = () => (
    <div className="space-y-3" data-testid="nursing-observations">
      {renderConfidenceIndicator()}
      {renderReasoningSteps()}
      {emergencyFlags.length > 0 && renderEmergencyFlags()}
    </div>
  );

  // Main content based on role and configuration
  const renderMainContent = () => {
    if (displayConfig.simplified) {
      return renderSimplifiedView();
    }

    if (userRole === 'nurse') {
      return renderNursingView();
    }

    return (
      <div className="space-y-4">
        {displayConfig.showConfidence && renderConfidenceIndicator()}
        {renderReasoningSteps()}
        {emergencyFlags.length > 0 && renderEmergencyFlags()}
        {renderEvidence()}

        {/* Clinical review button for physicians */}
        {userRole === 'physician' && onClinicalReview && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onClinicalReview(reasoning)}
            className="text-xs"
          >
            Request Clinical Review
          </Button>
        )}
      </div>
    );
  };

  // Handle emergency override and expansion
  if (emergencyOverride || severityLevel === 'emergency') {
    return (
      <div
        className={cn(
          'border-2 rounded-lg p-4 space-y-4 shadow-lg',
          'severity-emergency border-red-600 bg-red-50',
          'ring-2 ring-red-500 ring-offset-2',
          'motion-safe:transition-all motion-safe:duration-200',
          'contrast-more:border-4 contrast-more:border-red-800'
        )}
        data-testid="reasoning-display"
        data-variant="emergency"
        data-high-contrast-ready="true"
        role="alert"
        aria-label="Emergency medical reasoning"
      >
        {announceChanges && (
          <div
            ref={announceRef}
            className="sr-only"
            role="alert"
            aria-live="assertive"
          >
            Emergency reasoning information displayed
          </div>
        )}

        <div className="flex items-center space-x-2 mb-4">
          <Brain className="w-5 h-5 text-red-600" />
          <h3 className="font-medium text-red-800">
            Emergency Assessment Reasoning
          </h3>
        </div>

        {renderMainContent()}

        <div className="text-xs text-red-700 bg-red-100 p-2 rounded">
          <strong>Emergency Mode:</strong> All information displayed for
          immediate clinical decision-making.
        </div>
      </div>
    );
  }

  // Regular expandable view
  if (expandable) {
    return (
      <ProgressiveDisclosure
        title="AI Reasoning"
        variant={
          (severityLevel as any) === 'emergency' ? 'emergency' : 'medical'
        }
        defaultExpanded={isExpanded}
        onExpand={handleExpand}
        ariaLabel="Expand to view AI reasoning details"
      >
        <div
          className="space-y-4"
          data-testid="reasoning-display"
          data-high-contrast-ready="true"
        >
          {announceChanges && (
            <div
              ref={announceRef}
              className="sr-only"
              role="alert"
              aria-live="assertive"
            >
              {confidenceInfo.level === 'low' &&
                'Confidence level changed to low'}
            </div>
          )}

          {renderMainContent()}
        </div>
      </ProgressiveDisclosure>
    );
  }

  // Simple static view
  return (
    <div
      className={cn(
        'border rounded-lg p-4 space-y-4 shadow-sm',
        'motion-safe:transition-all motion-safe:duration-200',
        'hover:shadow-md focus-within:shadow-lg',
        'contrast-more:border-2 contrast-more:border-current',
        (severityLevel as any) === 'emergency' &&
          'border-red-400 bg-red-50 shadow-md',
        (severityLevel as any) === 'urgent' &&
          'border-amber-400 bg-amber-50 shadow-md',
        (severityLevel as any) === 'routine' && 'border-gray-400 bg-gray-50'
      )}
      data-testid="reasoning-display"
      data-severity={severityLevel}
      data-high-contrast-ready="true"
      role="region"
      aria-label="AI reasoning information"
    >
      <div className="flex items-center space-x-2">
        <Brain className="w-4 h-4 text-gray-600" />
        <h3
          className="text-sm font-medium text-gray-800"
          aria-label="AI reasoning plan"
        >
          AI Reasoning
        </h3>
      </div>

      {announceChanges && (
        <div
          ref={announceRef}
          className="sr-only"
          role="status"
          aria-live="polite"
        >
          Reasoning information loaded
        </div>
      )}

      {renderMainContent()}
    </div>
  );
}

export default ReasoningDisplay;
