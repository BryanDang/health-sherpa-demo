/**
 * Core TypeScript interfaces for Health Sherpa
 * Based on Sherpa_Plan.txt specifications
 */

// ============================================================================
// USER PROFILE & COMMUNICATION
// ============================================================================

export type UserRole = 'patient' | 'provider' | 'family_member' | 'caregiver';
export type ExpertiseLevel = 'novice' | 'intermediate' | 'expert';
export type CommunicationStyle =
  | 'technical'
  | 'conversational'
  | 'gentle'
  | 'direct';
export type SentenceLength = 'short' | 'medium' | 'long';
export type QuestioningStyle = 'detailed' | 'clarifying' | 'confirming';
export type EmotionalTone = 'analytical' | 'empathetic' | 'cautious';

export interface MirroringCues {
  vocabularyLevel: string[];
  sentenceLength: SentenceLength;
  questioningStyle: QuestioningStyle;
  emotionalTone: EmotionalTone;
}

export interface CommunicationPreferences {
  style: CommunicationStyle;
  mirroringCues: MirroringCues;
}

export interface ProfileUpdate {
  timestamp: string;
  field: string;
  oldValue: any;
  newValue: any;
}

export interface UserProfile {
  // Established in Phase 0
  role: UserRole;
  goals: string[];
  otherPartiesInvolved: string[];
  expertiseLevel: ExpertiseLevel;

  // Communication mirroring (established in Phase 0)
  communicationStyle: CommunicationStyle;
  mirroringCues: MirroringCues;

  // Evolution through phases
  additionalContext: string[];
  profileUpdates: ProfileUpdate[];

  // Export format
  exportableProfile: string; // Human-readable
  internalProfile: string; // Base64 encoded for system continuity
}

// ============================================================================
// SHERPA OPINION & KNOWLEDGE BASE
// ============================================================================

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';
export type KnowledgeGapSeverity = 'minor' | 'moderate' | 'critical';

export interface Finding {
  id: string;
  content: string;
  confidence: number;
  citations: CitationLocation[];
  riskLevel: RiskLevel;
}

export interface Assumption {
  id: string;
  content: string;
  confidence: number;
  basedOnFindings: string[]; // Finding IDs
}

export interface CitationLocation {
  documentId: string;
  lineNumbers: number[];
  excerpt: string;
}

export interface WebSource {
  url: string;
  title: string;
  excerpt: string;
  retrievedAt: string;
}

export interface ConfidenceTracking {
  overallConfidence: number; // 0-100
  findingConfidence: { [findingId: string]: number };
  knowledgeGapSeverity: { [gapId: string]: KnowledgeGapSeverity };

  // Re-analysis triggers
  confidenceThreshold: number; // When to suggest re-analysis
  lastReanalysisReason: string;

  // Phase readiness
  readyForNextPhase: boolean;
  phaseCompletionConfidence: number;
}

export interface SherpaOpinion {
  id: string;
  lastUpdated: string;

  // Core clinical understanding
  clinicalFindings: Finding[];
  knowledgeGaps: string[];
  assumptions: Assumption[];
  riskAssessment: RiskLevel;

  // Citations tied to opinion
  documentCitations: CitationLocation[];
  webSourceCitations: WebSource[];

  // Confidence tracking
  confidence: ConfidenceTracking;

  // User context integration
  userProfileInfluence: string; // How user context shaped opinion
}

// ============================================================================
// PHASE SYSTEM
// ============================================================================

export type PhaseNumber = 0 | 1 | 2 | 3 | 4;
export type DocumentProcessingStatus =
  | 'uploaded'
  | 'deidentified'
  | 'analyzed'
  | 'ready';

export interface Phase0State {
  userProfile: UserProfile;
  documentProcessingStatus: DocumentProcessingStatus;
}

export interface Insight {
  id: string;
  content: string;
  source: 'document' | 'web' | 'user';
  citations: CitationLocation[];
  webSources: WebSource[];
  confidence: number;
  phase: PhaseNumber;
}

export interface EvidenceGroup {
  id: string;
  heading: string;
  insights: Insight[];
  synthesizedContent: string;
  confidence: number;
}

export interface CausalChain {
  actionId: string;
  evidenceGroups: string[]; // EvidenceGroup IDs
  reasoning: string;
  confidence: number;
}

export interface Action {
  id: string;
  content: string;
  priority: number;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  actionability: 'immediate' | 'short_term' | 'long_term';
  relatedGoals: string[];
  evidenceSupport: string[]; // EvidenceGroup IDs
  causalChain: CausalChain;
}

// ============================================================================
// AI FLOW INTERFACES
// ============================================================================

export interface Phase1Input {
  userProfile: UserProfile;
  transcribedRedactedDocument: string;
  userGoals: string[];
  documentAnalysis: SherpaOpinion;
}

export interface Phase1Output {
  clinicalSummary: string;
  sherpaOpinion: SherpaOpinion;
  confidence: ConfidenceTracking;
}

export interface Phase2Input {
  sherpaOpinion: SherpaOpinion;
  currentGoal: string;
  userProfile: UserProfile;
  fullTranscript?: string;
}

export interface Phase2Output {
  insights: Insight[];
  updatedSherpaOpinion: SherpaOpinion;
  knowledgeGaps: string[];
  confidence: ConfidenceTracking;
}

export interface Phase3Input {
  phase2Insights: Insight[];
  sherpaOpinion: SherpaOpinion;
  userProfile: UserProfile;
  useAdvancedReasoning: true;
}

export interface Phase3Output {
  evidenceGroups: EvidenceGroup[];
  synthesizedHeadings: string[];
  updatedSherpaOpinion: SherpaOpinion;
  confidence: ConfidenceTracking;
}

export interface Phase4Input {
  evidenceGroups: EvidenceGroup[];
  sherpaOpinion: SherpaOpinion;
  userProfile: UserProfile;
  originalGoals: string[];
  useAdvancedReasoning: true;
}

export interface Phase4Output {
  prioritizedActions: Action[];
  actionRationale: CausalChain[];
  finalSherpaOpinion: SherpaOpinion;
  confidence: ConfidenceTracking;
}

// ============================================================================
// CHAT & MESSAGING
// ============================================================================

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  phase: PhaseNumber;
  citations?: CitationLocation[];
  confidence?: number;
  metadata?: {
    searchQueries?: string[];
    groundingSources?: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
    reasoning?: string;
    modelUsed?: string;
  };
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  currentPhase: PhaseNumber;
  sherpaOpinion: SherpaOpinion;
  userProfile: UserProfile;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// DOCUMENT MANAGEMENT
// ============================================================================

export interface HealthDocument {
  id: string;
  filename: string;
  content: string;
  lineNumberedContent: string;
  uploadedAt: string;
  processedAt?: string;
  deidentified: boolean;
  analysisComplete: boolean;
}

// ============================================================================
// UI STATE
// ============================================================================

export interface UIState {
  isProviderMode: boolean;
  currentAccordionSection: string | null;
  notificationTokens: { [section: string]: number };
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// STORE STATE
// ============================================================================

export interface AppState {
  // Chat state
  currentSession: ChatSession | null;
  sessions: ChatSession[];

  // Document state
  activeDocument: HealthDocument | null;
  uploadedDocuments: HealthDocument[];

  // Phase state
  currentPhase: PhaseNumber;
  phaseProgress: { [key in PhaseNumber]: boolean };

  // User profile state
  userProfile: UserProfile | null;

  // UI state
  ui: UIState;
}

// Export a simplified types module for legacy compatibility
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  phase?: PhaseNumber;
  citations?: CitationLocation[];
  confidence?: number;
}

export interface Document {
  id: string;
  name: string;
  filename: string;
  content: string;
  deidentifiedDocument?: string;
  deidentifiedText?: string;
  uploadedAt: string;
  processed?: boolean;
}
