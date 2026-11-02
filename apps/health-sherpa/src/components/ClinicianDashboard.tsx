/**
 * Clinician Dashboard - Transparent AI Control Center
 * Allows clinicians to view traces, modify behavior, and ensure safety
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Activity, 
  AlertCircle, 
  Brain, 
  CheckCircle, 
  Clock, 
  Settings,
  Shield,
  Zap,
  Database,
  GitBranch,
  Eye,
  Edit3
} from 'lucide-react';

interface TraceData {
  id: string;
  timestamp: Date;
  phase: number;
  type: 'mcp_call' | 'clinical_decision' | 'model_selection' | 'workflow';
  details: any;
  duration: number;
  status: 'success' | 'error' | 'warning';
}

interface ClinicianConfig {
  safetyThreshold: number;
  preferredModels: {
    simple: string;
    medium: string;
    complex: string;
  };
  autoEscalation: boolean;
  requireConfirmation: string[];
  customRules: Array<{
    condition: string;
    action: string;
    enabled: boolean;
  }>;
}

export default function ClinicianDashboard() {
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceData | null>(null);
  const [config, setConfig] = useState<ClinicianConfig>({
    safetyThreshold: 0.7,
    preferredModels: {
      simple: 'gemini-2.0-flash-lite',
      medium: 'gemini-2.0-flash',
      complex: 'gemini-2.5-pro',
    },
    autoEscalation: true,
    requireConfirmation: ['emergency', 'medication', 'diagnosis'],
    customRules: [],
  });
  const [activeTab, setActiveTab] = useState('traces');
  const [isLive, setIsLive] = useState(true);

  // Simulate real-time trace updates
  useEffect(() => {
    if (isLive) {
      const interval = setInterval(() => {
        fetchLatestTraces();
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isLive]);

  const fetchLatestTraces = async () => {
    // Open: fetch from a trace storage backend.
    const mockTrace: TraceData = {
      id: `trace-${Date.now()}`,
      timestamp: new Date(),
      phase: Math.floor(Math.random() * 5),
      type: ['mcp_call', 'clinical_decision', 'model_selection', 'workflow'][
        Math.floor(Math.random() * 4)
      ] as any,
      details: {
        action: 'Sample action',
        confidence: Math.random(),
      },
      duration: Math.floor(Math.random() * 1000),
      status: Math.random() > 0.8 ? 'error' : 'success',
    };
    
    setTraces(prev => [mockTrace, ...prev].slice(0, 100));
  };

  const getPhaseColor = (phase: number) => {
    const colors = ['blue', 'green', 'yellow', 'orange', 'red'];
    return colors[phase] || 'gray';
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mcp_call': return <Database className="h-4 w-4" />;
      case 'clinical_decision': return <Brain className="h-4 w-4" />;
      case 'model_selection': return <Zap className="h-4 w-4" />;
      case 'workflow': return <GitBranch className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  return (
    <div className="w-full h-full p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">AI Transparency Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor, trace, and configure AI behavior in real-time
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={isLive ? 'default' : 'secondary'} className="gap-1">
            {isLive && <span className="animate-pulse h-2 w-2 bg-green-500 rounded-full" />}
            {isLive ? 'Live' : 'Paused'}
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsLive(!isLive)}
          >
            {isLive ? 'Pause' : 'Resume'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="traces">
            <Eye className="h-4 w-4 mr-2" />
            Live Traces
          </TabsTrigger>
          <TabsTrigger value="decisions">
            <Brain className="h-4 w-4 mr-2" />
            Decisions
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="safety">
            <Shield className="h-4 w-4 mr-2" />
            Safety Rules
          </TabsTrigger>
        </TabsList>

        {/* Live Traces Tab */}
        <TabsContent value="traces" className="space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-8">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Stream</CardTitle>
                  <CardDescription>
                    Real-time view of AI activities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {traces.map((trace) => (
                        <div
                          key={trace.id}
                          onClick={() => setSelectedTrace(trace)}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {getTypeIcon(trace.type)}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{trace.type}</span>
                                <Badge variant="outline" className="text-xs">
                                  Phase {trace.phase}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {trace.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {trace.duration}ms
                            </span>
                            {trace.status === 'success' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : trace.status === 'error' ? (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-yellow-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="col-span-4">
              <Card>
                <CardHeader>
                  <CardTitle>Trace Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedTrace ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Type</Label>
                        <p className="font-mono text-sm">{selectedTrace.type}</p>
                      </div>
                      <div>
                        <Label className="text-xs">Phase</Label>
                        <p className="font-mono text-sm">{selectedTrace.phase}</p>
                      </div>
                      <div>
                        <Label className="text-xs">Duration</Label>
                        <p className="font-mono text-sm">{selectedTrace.duration}ms</p>
                      </div>
                      <div>
                        <Label className="text-xs">Details</Label>
                        <pre className="text-xs bg-muted p-2 rounded">
                          {JSON.stringify(selectedTrace.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Select a trace to view details
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Clinical Decisions Tab */}
        <TabsContent value="decisions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clinical Decision Paths</CardTitle>
              <CardDescription>
                View and understand AI reasoning for clinical decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {traces
                  .filter(t => t.type === 'clinical_decision')
                  .slice(0, 5)
                  .map((decision) => (
                    <Alert key={decision.id}>
                      <Brain className="h-4 w-4" />
                      <AlertTitle>
                        Clinical Decision at {decision.timestamp.toLocaleTimeString()}
                      </AlertTitle>
                      <AlertDescription>
                        <div className="mt-2 space-y-1">
                          <p>Phase: {decision.phase}</p>
                          <p>Confidence: {(decision.details.confidence * 100).toFixed(0)}%</p>
                          <p>Action: {decision.details.action}</p>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Behavior Configuration</CardTitle>
              <CardDescription>
                Adjust AI behavior without writing code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Safety Threshold */}
              <div className="space-y-2">
                <Label>Safety Threshold</Label>
                <Slider
                  value={[config.safetyThreshold]}
                  onValueChange={([value]) => 
                    setConfig(prev => ({ ...prev, safetyThreshold: value }))
                  }
                  max={1}
                  step={0.1}
                  className="w-full"
                />
                <span className="text-sm text-muted-foreground">
                  Current: {(config.safetyThreshold * 100).toFixed(0)}%
                </span>
              </div>

              {/* Model Preferences */}
              <div className="space-y-2">
                <Label>Preferred Models by Complexity</Label>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Simple Tasks</Label>
                    <RadioGroup 
                      value={config.preferredModels.simple}
                      onValueChange={(value) => 
                        setConfig(prev => ({
                          ...prev,
                          preferredModels: { ...prev.preferredModels, simple: value }
                        }))
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gemini-2.0-flash-lite" id="simple1" />
                        <Label htmlFor="simple1">Gemini 2.0 Flash Lite (Fast)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gemini-2.5-flash-lite" id="simple2" />
                        <Label htmlFor="simple2">Gemini 2.5 Flash Lite</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-xs">Medium Tasks</Label>
                    <RadioGroup 
                      value={config.preferredModels.medium}
                      onValueChange={(value) => 
                        setConfig(prev => ({
                          ...prev,
                          preferredModels: { ...prev.preferredModels, medium: value }
                        }))
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gemini-2.0-flash" id="medium1" />
                        <Label htmlFor="medium1">Gemini 2.0 Flash (Balanced)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gemini-2.5-flash" id="medium2" />
                        <Label htmlFor="medium2">Gemini 2.5 Flash</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-xs">Complex Tasks</Label>
                    <RadioGroup 
                      value={config.preferredModels.complex}
                      onValueChange={(value) => 
                        setConfig(prev => ({
                          ...prev,
                          preferredModels: { ...prev.preferredModels, complex: value }
                        }))
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gemini-2.5-pro" id="complex1" />
                        <Label htmlFor="complex1">Gemini 2.5 Pro (Advanced)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gemini-2.0-flash" id="complex2" />
                        <Label htmlFor="complex2">Gemini 2.0 Flash</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>

              <Button className="w-full">
                <Edit3 className="h-4 w-4 mr-2" />
                Save Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Safety Rules Tab */}
        <TabsContent value="safety" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Safety Guardrails</CardTitle>
              <CardDescription>
                Configure safety rules and automatic escalations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Active Safety Rules</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>• Auto-escalate when confidence {'<'} 60%</li>
                    <li>• Require confirmation for emergency recommendations</li>
                    <li>• Flag red flag symptoms immediately</li>
                    <li>• Limit medication suggestions to OTC only</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Custom Safety Rules</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span className="text-sm">
                      If symptom contains "chest pain" → Escalate immediately
                    </span>
                    <Button size="sm" variant="ghost">Edit</Button>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded">
                    <span className="text-sm">
                      If age {'<'} 18 → Require parental consent
                    </span>
                    <Button size="sm" variant="ghost">Edit</Button>
                  </div>
                </div>
                <Button variant="outline" className="w-full">
                  Add Custom Rule
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}