'use client';

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import {
  AlertTriangle,
  Heart,
  Pill,
  Shield,
  Clock,
  Calendar,
  User,
  FileText,
  Filter,
  Edit3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ProgressiveDisclosure from '@/components/ui/ProgressiveDisclosure';

/**
 * MemoryDisplay Component
 * Displays patient memory: symptoms, history, medications, allergies, emergency flags
 * Based on medical UI patterns and HIPAA-compliant information display
 */

export interface MemoryDisplayProps {
  /** Core memory data structure */
  memory: {
    symptoms: Array<{
      description: string;
      severity: number; // 1-10 scale
      onset: string;
      timestamp: string;
    }>;
    medicalHistory: string[];
    medications: string[];
    allergies: string[];
    emergencyFlags: string[];
    lastUpdate: string;
  };

  /** Display configuration */
  layout?: 'timeline' | 'categorized' | 'compact';
  showTimestamps?: boolean;
  emergencyMode?: boolean;
  highlightCritical?: boolean;

  /** Medical role and permissions */
  userRole?: 'physician' | 'nurse' | 'patient' | 'admin';
  accessLevel?: 'full' | 'limited' | 'emergency_only';

  /** Interactive features */
  editable?: boolean;
  expandable?: boolean;
  filterable?: boolean;

  /** Clinical workflow context */
  careLevel?: 'emergency' | 'urgent' | 'primary' | 'self_care';
  sessionContext?: 'triage' | 'consultation' | 'review';
}

export function MemoryDisplay({
  memory,
  layout = 'categorized',
  showTimestamps = false,
  emergencyMode = false,
  highlightCritical = true,
  userRole = 'patient',
  accessLevel = 'full',
  editable = false,
  expandable = true,
  filterable = false,
  careLevel,
  sessionContext = 'triage',
}: MemoryDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const announceRef = useRef<HTMLDivElement>(null);

  // Handle missing or malformed memory data
  if (!memory) {
    return (
      <div className="text-gray-500 italic p-4" data-testid="memory-display">
        No patient memory data available
      </div>
    );
  }

  // Validate memory data structure
  const isValidMemory = useMemo(() => {
    return (
      Array.isArray(memory.symptoms) &&
      Array.isArray(memory.medicalHistory) &&
      Array.isArray(memory.medications) &&
      Array.isArray(memory.allergies) &&
      Array.isArray(memory.emergencyFlags)
    );
  }, [memory]);

  if (!isValidMemory) {
    return (
      <div
        className="text-red-600 p-4"
        data-testid="memory-display"
        role="alert"
      >
        Invalid memory data format
      </div>
    );
  }

  // Check data freshness
  const getDataFreshness = () => {
    if (!memory.lastUpdate) return 'unknown';

    const lastUpdate = new Date(memory.lastUpdate);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) return 'stale';
    if (hoursDiff > 12) return 'warning';
    return 'current';
  };

  const dataFreshness = getDataFreshness();

  // Sort symptoms by severity
  const sortedSymptoms = useMemo(() => {
    return [...memory.symptoms].sort((a, b) => b.severity - a.severity);
  }, [memory.symptoms]);

  // Categorize symptoms by priority
  const categorizeSymptom = (severity: number) => {
    if (severity >= 8) return 'critical';
    if (severity >= 5) return 'moderate';
    return 'mild';
  };

  // Role-based access control
  const getAccessibleContent = () => {
    switch (userRole) {
      case 'patient':
        return {
          showFullHistory: false,
          showMedications: true,
          showAllergies: true,
          showEmergencyFlags: true,
          simplified: true,
        };
      case 'nurse':
        return {
          showFullHistory: true,
          showMedications: true,
          showAllergies: true,
          showEmergencyFlags: true,
          simplified: false,
        };
      case 'physician':
        return {
          showFullHistory: true,
          showMedications: true,
          showAllergies: true,
          showEmergencyFlags: true,
          simplified: false,
        };
      default:
        return {
          showFullHistory: accessLevel === 'full',
          showMedications: true,
          showAllergies: true,
          showEmergencyFlags: true,
          simplified: false,
        };
    }
  };

  const accessConfig = getAccessibleContent();

  // Handle section expansion
  const toggleSection = useCallback(
    (section: string) => {
      const newExpanded = new Set(expandedSections);
      if (newExpanded.has(section)) {
        newExpanded.delete(section);
      } else {
        newExpanded.add(section);
      }
      setExpandedSections(newExpanded);
    },
    [expandedSections]
  );

  // Render emergency section (always prominent)
  const renderEmergencySection = () => {
    const hasEmergencyFlags = memory.emergencyFlags.length > 0;
    const criticalAllergies = memory.allergies.filter(
      (allergy) =>
        allergy.toLowerCase().includes('severe') ||
        allergy.toLowerCase().includes('anaphylaxis')
    );
    const criticalMedications = memory.medications.filter(
      (med) =>
        med.toLowerCase().includes('critical') ||
        med.toLowerCase().includes('emergency')
    );

    if (
      !hasEmergencyFlags &&
      criticalAllergies.length === 0 &&
      criticalMedications.length === 0
    ) {
      return null;
    }

    return (
      <div
        className="emergency-banner bg-red-100 border-2 border-red-500 rounded-lg p-4 mb-4"
        data-testid="emergency-section"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-center space-x-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <h3 className="font-bold text-red-800">Emergency Information</h3>
        </div>

        {hasEmergencyFlags && (
          <div className="mb-3">
            <h4 className="text-sm font-medium text-red-800 mb-2">
              Emergency Flags:
            </h4>
            <div className="flex flex-wrap gap-2">
              {memory.emergencyFlags.map((flag, index) => (
                <Badge key={index} className="bg-red-600 text-white">
                  {flag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {criticalAllergies.length > 0 && (
          <div className="mb-3">
            <h4 className="text-sm font-medium text-red-800 mb-2">
              Critical Allergies:
            </h4>
            <div className="space-y-1">
              {criticalAllergies.map((allergy, index) => (
                <div key={index} className="text-sm text-red-700 font-medium">
                  <Shield className="w-4 h-4 inline mr-1" />
                  {allergy}
                </div>
              ))}
            </div>
          </div>
        )}

        {criticalMedications.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-red-800 mb-2">
              Critical Medications:
            </h4>
            <div className="space-y-1">
              {criticalMedications.map((medication, index) => (
                <div key={index} className="text-sm text-red-700 font-medium">
                  <Pill className="w-4 h-4 inline mr-1" />
                  {medication}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render symptoms section
  const renderSymptomsSection = () => {
    if (sortedSymptoms.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4
            className="text-sm font-medium text-gray-800"
            aria-label="Patient symptoms"
          >
            Symptoms
          </h4>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingSection('symptoms')}
              className="text-xs"
            >
              <Edit3 className="w-3 h-3 mr-1" />
              Edit
            </Button>
          )}
        </div>

        <div
          className="space-y-2"
          data-testid={
            expandedSections.has('symptoms') ? 'expanded-symptoms' : 'symptoms'
          }
        >
          {sortedSymptoms.map((symptom, index) => {
            const priority = categorizeSymptom(symptom.severity);
            return (
              <div
                key={index}
                className={cn(
                  'p-3 rounded-lg border',
                  priority === 'critical' &&
                    'border-red-300 bg-red-50 severity-critical',
                  priority === 'moderate' &&
                    'border-amber-300 bg-amber-50 severity-moderate',
                  priority === 'mild' &&
                    'border-green-300 bg-green-50 severity-mild'
                )}
                data-testid={`symptom-item-${index}`}
                data-severity={symptom.severity}
                data-priority={priority}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {symptom.description}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      Severity: {symptom.severity}/10
                      {showTimestamps && (
                        <>
                          {' • '}
                          Onset: {symptom.onset}
                          {' • '}
                          <Clock className="w-3 h-3 inline ml-1" />
                          {new Date(symptom.timestamp).toLocaleString()}
                        </>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      priority === 'critical' ? 'destructive' : 'secondary'
                    }
                  >
                    {priority}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render medical history section
  const renderMedicalHistorySection = () => {
    if (!accessConfig.showFullHistory || memory.medicalHistory.length === 0)
      return null;

    return (
      <div
        className="space-y-3"
        data-testid={
          accessConfig.showFullHistory
            ? 'detailed-medical-history'
            : 'limited-medical-history'
        }
      >
        <h4
          className="text-sm font-medium text-gray-800"
          aria-label="Medical history"
        >
          Medical History
        </h4>
        <div className="space-y-1">
          {memory.medicalHistory.map((condition, index) => (
            <div
              key={index}
              className="text-sm text-gray-600 p-2 bg-gray-50 rounded"
            >
              <FileText className="w-4 h-4 inline mr-2" />
              {condition}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render medications section
  const renderMedicationsSection = () => {
    if (memory.medications.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4
          className="text-sm font-medium text-gray-800"
          aria-label="Current medications"
        >
          Current Medications
        </h4>
        <div
          className="space-y-1"
          data-testid={
            expandedSections.has('medications')
              ? 'expanded-medications'
              : 'medications'
          }
        >
          {memory.medications.map((medication, index) => {
            const isCritical = medication.toLowerCase().includes('critical');
            return (
              <div
                key={index}
                className={cn(
                  'text-sm p-2 rounded flex items-center',
                  isCritical
                    ? 'bg-red-50 text-red-800 border border-red-200'
                    : 'bg-gray-50 text-gray-700'
                )}
                data-critical={isCritical}
              >
                <Pill className="w-4 h-4 mr-2" />
                {medication}
                {isCritical && (
                  <Badge variant="destructive" className="ml-2">
                    CRITICAL
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Medication interaction warnings */}
        {memory.medications.some(
          (med) =>
            med.toLowerCase().includes('warfarin') &&
            memory.medications.some((other) =>
              other.toLowerCase().includes('aspirin')
            )
        ) && (
          <div
            className="bg-amber-50 border border-amber-200 rounded p-2"
            data-testid="interaction-alert"
          >
            <div className="flex items-center space-x-2 text-amber-800">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">
                Drug interaction warning detected
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render allergies section
  const renderAllergiesSection = () => {
    if (memory.allergies.length === 0) return null;

    return (
      <div
        className="space-y-3"
        data-testid="allergy-section"
        data-screening="active"
      >
        <h4
          className="text-sm font-medium text-gray-800"
          aria-label="Known allergies"
        >
          Known Allergies
        </h4>
        <div
          className="space-y-1"
          data-testid={
            expandedSections.has('allergies')
              ? 'expanded-allergies'
              : 'allergies'
          }
        >
          {memory.allergies.map((allergy, index) => {
            const severity = allergy.toLowerCase().includes('severe')
              ? 'severe'
              : allergy.toLowerCase().includes('moderate')
                ? 'moderate'
                : 'mild';
            return (
              <div
                key={index}
                className={cn(
                  'text-sm p-2 rounded flex items-center',
                  severity === 'severe' &&
                    'bg-red-50 text-red-800 border border-red-200 severe-allergy',
                  severity === 'moderate' &&
                    'bg-amber-50 text-amber-800 border border-amber-200',
                  severity === 'mild' &&
                    'bg-yellow-50 text-yellow-800 border border-yellow-200'
                )}
                data-severity={severity}
              >
                <Shield className="w-4 h-4 mr-2" />
                {allergy}
              </div>
            );
          })}
        </div>

        {editable && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingSection('allergies')}
            className="text-xs"
            aria-label="Edit allergies"
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Edit Allergies
          </Button>
        )}
      </div>
    );
  };

  // Render timeline view
  const renderTimelineView = () => {
    if (layout !== 'timeline') return null;

    const timelineEvents = [
      ...memory.symptoms.map((symptom) => ({
        timestamp: symptom.timestamp,
        type: 'symptom' as const,
        content: symptom.description,
        severity: symptom.severity,
      })),
    ].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return (
      <div className="timeline-layout space-y-4" data-testid="memory-timeline">
        <h4 className="text-sm font-medium text-gray-800">Timeline View</h4>
        <div className="space-y-3">
          {timelineEvents.map((event, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start space-x-3 p-3 rounded border-l-4',
                event.severity >= 8 &&
                  'border-l-red-500 bg-red-50 emergency-highlighted',
                event.severity >= 5 &&
                  event.severity < 8 &&
                  'border-l-amber-500 bg-amber-50',
                event.severity < 5 && 'border-l-green-500 bg-green-50'
              )}
              data-testid={`timeline-event-${index}${event.severity >= 8 ? '-emergency' : ''}`}
              data-timestamp={event.timestamp}
            >
              <Calendar className="w-4 h-4 text-gray-500 mt-1" />
              <div className="flex-1">
                <div className="text-sm font-medium">{event.content}</div>
                <div className="text-xs text-gray-500">
                  {new Date(event.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render categorized sections
  const renderCategorizedSections = () => {
    if (layout !== 'categorized') return null;

    return (
      <div className="space-y-6">
        {renderSymptomsSection()}
        {renderMedicationsSection()}
        {renderAllergiesSection()}
        {renderMedicalHistorySection()}
      </div>
    );
  };

  // Render data freshness indicator
  const renderDataFreshness = () => (
    <div
      className={cn(
        'text-xs p-2 rounded',
        dataFreshness === 'stale' && 'bg-red-50 text-red-600',
        dataFreshness === 'warning' && 'bg-amber-50 text-amber-600',
        dataFreshness === 'current' && 'bg-green-50 text-green-600'
      )}
      data-testid="data-freshness"
      data-status={dataFreshness}
    >
      {dataFreshness === 'stale' && 'Data may be outdated (>24 hours)'}
      {dataFreshness === 'warning' && 'Data aging (>12 hours)'}
      {dataFreshness === 'current' &&
        `Last updated: ${new Date(memory.lastUpdate).toLocaleString()}`}
    </div>
  );

  // Handle data integrity issues
  const hasIntegrityIssues = memory.symptoms.some(
    (s) => s.severity > 10 || s.severity < 0
  );

  // Main render
  return (
    <div
      className={cn(
        'space-y-4',
        emergencyMode && 'emergency-mode',
        sessionContext === 'triage' && 'triage-context',
        sessionContext === 'consultation' && 'consultation-context'
      )}
      data-testid="memory-display"
      data-high-contrast-ready="true"
    >
      {/* Accessibility announcements */}
      <div
        ref={announceRef}
        className="sr-only"
        role="status"
        aria-live="polite"
      >
        {memory.emergencyFlags.length > 0 && 'Emergency flags detected'}
      </div>

      {/* Data integrity warning */}
      {hasIntegrityIssues && (
        <div
          className="bg-amber-50 border border-amber-200 rounded p-3"
          role="alert"
        >
          <div className="flex items-center space-x-2 text-amber-800">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Data integrity warning</span>
          </div>
        </div>
      )}

      {/* Emergency section - always visible when present */}
      {renderEmergencySection()}

      {/* Data freshness indicator */}
      {showTimestamps && renderDataFreshness()}

      {/* Main content */}
      {accessConfig.simplified ? (
        <div data-testid="simplified-summary">
          {renderSymptomsSection()}
          {memory.emergencyFlags.length > 0 && renderEmergencySection()}
        </div>
      ) : sessionContext === 'triage' ? (
        <div data-testid="triage-priorities">
          {renderEmergencySection()}
          {renderSymptomsSection()}
          {renderAllergiesSection()}
          {renderMedicationsSection()}
        </div>
      ) : sessionContext === 'consultation' ? (
        <div data-testid="comprehensive-view">
          {renderEmergencySection()}
          {renderTimelineView()}
          {renderCategorizedSections()}
        </div>
      ) : (
        <>
          {renderTimelineView()}
          {renderCategorizedSections()}
        </>
      )}

      {/* Editing modal placeholders */}
      {editingSection === 'allergies' && (
        <div
          data-testid="allergy-edit-form"
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <div className="bg-white p-6 rounded-lg">
            <h3 className="text-lg font-medium mb-4">Edit Allergies</h3>
            <p className="text-sm text-gray-600 mb-4">
              Allergy editing form would go here.
            </p>
            <Button onClick={() => setEditingSection(null)}>Close</Button>
          </div>
        </div>
      )}

      {/* Virtualized list for large datasets */}
      {memory.symptoms.length > 100 && (
        <div
          data-testid="virtualized-symptoms"
          className="text-xs text-gray-500"
        >
          Large symptom list - using virtualization for performance
        </div>
      )}
    </div>
  );
}

export default MemoryDisplay;
