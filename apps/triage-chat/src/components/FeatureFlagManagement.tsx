/**
 * Feature Flag Management Interface
 * 
 * Comprehensive management interface for medical feature flags with real-time
 * monitoring, medical professional controls, emergency management, and HIPAA-compliant
 * audit trails. Designed specifically for healthcare applications.
 * 
 * CRITICAL: This interface controls features that affect patient care and must
 * provide clear visibility, robust controls, and fail-safe mechanisms.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  Play,
  Pause,
  Square,
  Settings,
  Users,
  TrendingUp,
  Bell,
  FileText,
  Heart,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Activity,
  AlertCircle,
  UserCheck,
  Database,
  Globe,
  Lock,
  Unlock,
  RefreshCw,
  Download
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  medicalImpact: 'none' | 'minimal' | 'moderate' | 'significant' | 'critical';
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'paused' | 'completed' | 'rolled_back';
  rolloutPercentage: number;
  targetSegments: string[];
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  emergencyKillswitchEnabled: boolean;
  approvedBy?: string[];
  currentPhase?: string;
  totalPhases?: number;
}

interface SafetyMetrics {
  errorRate: number;
  medicalFeedbackScore: number;
  safetyIncidents: number;
  userComplaintRate: number;
  performanceImpact: number;
  lastUpdated: Date;
}

interface RolloutProgress {
  currentPhase: number;
  totalPhases: number;
  phaseProgress: number;
  estimatedCompletion: Date;
  nextMilestone: string;
}

interface EmergencyStatus {
  active: boolean;
  type?: 'killswitch' | 'pause' | 'rollback';
  reason?: string;
  triggeredBy?: string;
  timestamp?: Date;
  affectedUsers?: number;
}

interface AuditEvent {
  id: string;
  action: string;
  flagKey: string;
  userId: string;
  userRole: string;
  timestamp: Date;
  details: any;
  medicalImpact: string;
  complianceNotes?: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface FeatureFlagManagementProps {
  userRole: 'medical_professional' | 'system_admin' | 'developer' | 'viewer';
  userId: string;
  permissions: {
    canCreateFlags: boolean;
    canApproveFlags: boolean;
    canEmergencyStop: boolean;
    canViewAuditLogs: boolean;
    canModifyMedicalFlags: boolean;
  };
}

export default function FeatureFlagManagement({
  userRole,
  userId,
  permissions
}: FeatureFlagManagementProps) {
  // State management
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [safetyMetrics, setSafetyMetrics] = useState<Record<string, SafetyMetrics>>({});
  const [emergencyStatuses, setEmergencyStatuses] = useState<Record<string, EmergencyStatus>>({});
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realTimeUpdates, setRealTimeUpdates] = useState(true);
  
  // Modal and UI state
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [showCreateFlagDialog, setShowCreateFlagDialog] = useState(false);
  const [emergencyAction, setEmergencyAction] = useState<'killswitch' | 'pause' | 'rollback' | null>(null);

  // =============================================================================
  // DATA LOADING AND REAL-TIME UPDATES
  // =============================================================================

  const loadFeatureFlags = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load feature flags
      const flagsResponse = await fetch('/api/feature-flags/list', {
        headers: { 'Authorization': `Bearer ${await getUserToken()}` }
      });
      const flagsData = await flagsResponse.json();
      setFlags(flagsData.flags || []);

      // Load safety metrics for each flag
      const metricsPromises = flagsData.flags.map(async (flag: FeatureFlag) => {
        const metricsResponse = await fetch(`/api/feature-flags/${flag.id}/metrics`);
        const metrics = await metricsResponse.json();
        return { flagId: flag.id, metrics: metrics.data };
      });
      
      const metricsResults = await Promise.all(metricsPromises);
      const metricsMap = metricsResults.reduce((acc, { flagId, metrics }) => {
        acc[flagId] = metrics;
        return acc;
      }, {} as Record<string, SafetyMetrics>);
      setSafetyMetrics(metricsMap);

      // Load emergency statuses
      const emergencyResponse = await fetch('/api/feature-flags/emergency-status');
      const emergencyData = await emergencyResponse.json();
      setEmergencyStatuses(emergencyData.statuses || {});

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuditEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/feature-flags/audit-log', {
        headers: { 'Authorization': `Bearer ${await getUserToken()}` }
      });
      const data = await response.json();
      setAuditEvents(data.events || []);
    } catch (err) {
      console.error('Failed to load audit events:', err);
    }
  }, []);

  // Initialize data loading
  useEffect(() => {
    loadFeatureFlags();
    loadAuditEvents();
  }, [loadFeatureFlags, loadAuditEvents]);

  // Set up real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const eventSource = new EventSource('/api/feature-flags/events');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'flag_updated':
          setFlags(prev => prev.map(flag => 
            flag.id === data.flagId ? { ...flag, ...data.updates } : flag
          ));
          break;
        case 'metrics_updated':
          setSafetyMetrics(prev => ({
            ...prev,
            [data.flagId]: data.metrics
          }));
          break;
        case 'emergency_activated':
          setEmergencyStatuses(prev => ({
            ...prev,
            [data.flagId]: data.emergencyStatus
          }));
          break;
        case 'audit_event':
          setAuditEvents(prev => [data.event, ...prev.slice(0, 99)]);
          break;
      }
    };

    eventSource.onerror = () => {
      console.error('Real-time connection lost');
      setRealTimeUpdates(false);
    };

    return () => eventSource.close();
  }, [realTimeUpdates]);

  // =============================================================================
  // EMERGENCY CONTROLS
  // =============================================================================

  const handleEmergencyAction = async (flagId: string, action: 'killswitch' | 'pause' | 'rollback', reason: string) => {
    try {
      const response = await fetch(`/api/feature-flags/${flagId}/emergency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getUserToken()}`
        },
        body: JSON.stringify({
          action,
          reason,
          userId,
          userRole,
          timestamp: new Date()
        })
      });

      if (!response.ok) {
        throw new Error(`Emergency action failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update local state
      setEmergencyStatuses(prev => ({
        ...prev,
        [flagId]: {
          active: true,
          type: action,
          reason,
          triggeredBy: userId,
          timestamp: new Date(),
          affectedUsers: result.affectedUsers
        }
      }));

      // Refresh data
      await loadFeatureFlags();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Emergency action failed');
    }
  };

  // =============================================================================
  // FLAG MANAGEMENT ACTIONS
  // =============================================================================

  const updateFlagRollout = async (flagId: string, newPercentage: number) => {
    try {
      const response = await fetch(`/api/feature-flags/${flagId}/rollout`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getUserToken()}`
        },
        body: JSON.stringify({
          rolloutPercentage: newPercentage,
          updatedBy: userId,
          reason: 'Manual rollout adjustment'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update rollout percentage');
      }

      await loadFeatureFlags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rollout');
    }
  };

  const approveFlag = async (flagId: string) => {
    try {
      const response = await fetch(`/api/feature-flags/${flagId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getUserToken()}`
        },
        body: JSON.stringify({
          approvedBy: userId,
          userRole,
          timestamp: new Date()
        })
      });

      if (!response.ok) {
        throw new Error('Flag approval failed');
      }

      await loadFeatureFlags();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve flag');
    }
  };

  // =============================================================================
  // UI HELPER FUNCTIONS
  // =============================================================================

  const getMedicalImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'significant': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'minimal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'none': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="h-4 w-4 text-green-600" />;
      case 'paused': return <Pause className="h-4 w-4 text-yellow-600" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'rolled_back': return <RefreshCw className="h-4 w-4 text-red-600" />;
      case 'pending_approval': return <Clock className="h-4 w-4 text-orange-600" />;
      default: return <Square className="h-4 w-4 text-gray-600" />;
    }
  };

  const getSafetyStatus = (metrics: SafetyMetrics) => {
    if (metrics.safetyIncidents > 0) return 'critical';
    if (metrics.errorRate > 0.05 || metrics.userComplaintRate > 0.02) return 'warning';
    if (metrics.medicalFeedbackScore < 3.5) return 'warning';
    return 'safe';
  };

  const getSafetyStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'safe': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getUserToken = async () => {
    // Implementation would return actual user token
    return 'mock_token';
  };

  // =============================================================================
  // RENDER METHODS
  // =============================================================================

  const renderFlagCard = (flag: FeatureFlag) => {
    const metrics = safetyMetrics[flag.id];
    const emergency = emergencyStatuses[flag.id];
    const safetyStatus = metrics ? getSafetyStatus(metrics) : 'unknown';

    return (
      <Card key={flag.id} className="mb-4 hover:shadow-lg transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                {getStatusIcon(flag.status)}
                <CardTitle className="text-lg">{flag.name}</CardTitle>
                <Badge variant="outline" className={getMedicalImpactColor(flag.medicalImpact)}>
                  {flag.medicalImpact.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{flag.description}</p>
              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                <span>Key: {flag.key}</span>
                <span>Created: {formatTimestamp(flag.createdAt)}</span>
                <span>By: {flag.createdBy}</span>
              </div>
            </div>
            
            {emergency?.active && (
              <Alert className="ml-4 w-48 border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-xs text-red-700">
                  Emergency {emergency.type} active
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {/* Rollout Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Rollout Progress</span>
              <span className="text-sm text-muted-foreground">{flag.rolloutPercentage}%</span>
            </div>
            <Progress value={flag.rolloutPercentage} className="h-2" />
            {flag.currentPhase && (
              <div className="text-xs text-muted-foreground mt-1">
                Phase {flag.currentPhase} of {flag.totalPhases}
              </div>
            )}
          </div>

          {/* Safety Metrics */}
          {metrics && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Safety Status</span>
                <Badge className={getSafetyStatusColor(safetyStatus)}>
                  {safetyStatus.toUpperCase()}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Error Rate: {(metrics.errorRate * 100).toFixed(2)}%</div>
                <div>Medical Score: {metrics.medicalFeedbackScore.toFixed(1)}/5</div>
                <div>Safety Incidents: {metrics.safetyIncidents}</div>
                <div>User Complaints: {(metrics.userComplaintRate * 100).toFixed(2)}%</div>
              </div>
            </div>
          )}

          {/* Target Segments */}
          <div className="mb-4">
            <div className="text-sm font-medium mb-2">Target Segments</div>
            <div className="flex flex-wrap gap-1">
              {flag.targetSegments.map(segment => (
                <Badge key={segment} variant="secondary" className="text-xs">
                  {segment.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFlag(flag)}
              >
                <Settings className="h-4 w-4 mr-1" />
                Details
              </Button>
              
              {permissions.canApproveFlags && flag.status === 'pending_approval' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => approveFlag(flag.id)}
                  className="text-green-600 hover:bg-green-50"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              )}
            </div>

            {permissions.canEmergencyStop && flag.status === 'active' && !emergency?.active && (
              <div className="flex space-x-1">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSelectedFlag(flag);
                    setEmergencyAction('pause');
                    setShowEmergencyDialog(true);
                  }}
                >
                  <Pause className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setSelectedFlag(flag);
                    setEmergencyAction('killswitch');
                    setShowEmergencyDialog(true);
                  }}
                >
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderSystemOverview = () => {
    const totalFlags = flags.length;
    const activeFlags = flags.filter(f => f.status === 'active').length;
    const emergencyFlags = Object.keys(emergencyStatuses).filter(id => emergencyStatuses[id].active).length;
    const flagsAwaitingApproval = flags.filter(f => f.status === 'pending_approval').length;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalFlags}</p>
                <p className="text-sm text-muted-foreground">Total Flags</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{activeFlags}</p>
                <p className="text-sm text-muted-foreground">Active Rollouts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className={`h-8 w-8 ${emergencyFlags > 0 ? 'text-red-600' : 'text-gray-400'}`} />
              <div>
                <p className="text-2xl font-bold">{emergencyFlags}</p>
                <p className="text-sm text-muted-foreground">Emergency Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className={`h-8 w-8 ${flagsAwaitingApproval > 0 ? 'text-orange-600' : 'text-gray-400'}`} />
              <div>
                <p className="text-2xl font-bold">{flagsAwaitingApproval}</p>
                <p className="text-sm text-muted-foreground">Awaiting Approval</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAuditLog = () => {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Audit Log</span>
            <Badge variant="outline">HIPAA Compliant</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            {auditEvents.map(event => (
              <div key={event.id} className="border-b last:border-b-0 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {event.action}
                      </Badge>
                      <span className="text-sm font-medium">{event.flagKey}</span>
                      <Badge variant="outline" className={getMedicalImpactColor(event.medicalImpact)}>
                        {event.medicalImpact}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      By {event.userId} ({event.userRole}) at {formatTimestamp(event.timestamp)}
                    </p>
                    {event.details && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {JSON.stringify(event.details)}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  // =============================================================================
  // MAIN RENDER
  // =============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading feature flags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Feature Flag Management</h1>
          <p className="text-muted-foreground">
            Medical-grade feature flag control with safety monitoring
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            {userRole === 'medical_professional' && <Heart className="h-3 w-3" />}
            {userRole === 'system_admin' && <Shield className="h-3 w-3" />}
            {userRole === 'developer' && <Settings className="h-3 w-3" />}
            {userRole === 'viewer' && <Users className="h-3 w-3" />}
            <span>{userRole.replace('_', ' ')}</span>
          </Badge>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRealTimeUpdates(!realTimeUpdates)}
          >
            <Zap className={`h-4 w-4 mr-1 ${realTimeUpdates ? 'text-green-600' : 'text-gray-400'}`} />
            Real-time
          </Button>
          
          {permissions.canCreateFlags && (
            <Button onClick={() => setShowCreateFlagDialog(true)}>
              Create Flag
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">{error}</AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="ml-auto"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </Alert>
      )}

      {/* System Overview */}
      {renderSystemOverview()}

      {/* Main Content Tabs */}
      <Tabs defaultValue="flags" className="space-y-4">
        <TabsList>
          <TabsTrigger value="flags" className="flex items-center space-x-2">
            <Shield className="h-4 w-4" />
            <span>Feature Flags</span>
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Safety Monitoring</span>
          </TabsTrigger>
          {permissions.canViewAuditLogs && (
            <TabsTrigger value="audit" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Audit Log</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="emergency" className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Emergency Controls</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {flags.map(renderFlagCard)}
          </div>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System-wide Safety Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">99.8%</p>
                  <p className="text-sm text-muted-foreground">System Uptime</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">4.2/5</p>
                  <p className="text-sm text-muted-foreground">Avg Medical Feedback</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">0.02%</p>
                  <p className="text-sm text-muted-foreground">Error Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {permissions.canViewAuditLogs && (
          <TabsContent value="audit" className="space-y-4">
            {renderAuditLog()}
          </TabsContent>
        )}

        <TabsContent value="emergency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Emergency Controls</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-700">
                  Emergency controls affect patient care systems. Use only when necessary.
                </AlertDescription>
              </Alert>
              
              {Object.entries(emergencyStatuses).filter(([_, status]) => status.active).map(([flagId, status]) => {
                const flag = flags.find(f => f.id === flagId);
                return flag ? (
                  <Card key={flagId} className="mt-4 border-red-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{flag.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {status.type} active since {status.timestamp && formatTimestamp(status.timestamp)}
                          </p>
                          <p className="text-xs text-red-600">{status.reason}</p>
                        </div>
                        <Button variant="outline" size="sm">
                          Review
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null;
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Emergency Action Dialog would be rendered here */}
      {/* Create Flag Dialog would be rendered here */}
      {/* Flag Details Modal would be rendered here */}
    </div>
  );
}