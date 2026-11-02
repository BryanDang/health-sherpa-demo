'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Target, Heart, Shield, Brain } from 'lucide-react';

interface GoalSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalSet: (goal: string, context: any) => void;
}

const COMMON_GOALS = [
  {
    id: 'understand_symptoms',
    title: 'Understand my symptoms',
    description:
      'I want to understand what my symptoms might mean and when to seek care',
    icon: Brain,
    prompt:
      'Help me understand what my symptoms might mean and what I should do about them.',
  },
  {
    id: 'emergency_guidance',
    title: 'Get emergency guidance',
    description:
      'I need to know if my situation requires immediate medical attention',
    icon: Shield,
    prompt:
      'I need to know if this is a medical emergency and what I should do right now.',
  },
  {
    id: 'find_providers',
    title: 'Find healthcare providers',
    description:
      'I want to find the right healthcare provider for my situation',
    icon: Heart,
    prompt:
      'Help me find the right healthcare provider or facility for my needs.',
  },
  {
    id: 'prepare_visit',
    title: 'Prepare for a medical visit',
    description:
      'I want to prepare questions and organize my information for a doctor visit',
    icon: Target,
    prompt:
      'Help me prepare for my upcoming medical appointment and organize my questions.',
  },
];

export function GoalSettingModal({
  isOpen,
  onClose,
  onGoalSet,
}: GoalSettingModalProps) {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleGoalSelection = (goalId: string) => {
    const goal = COMMON_GOALS.find((g) => g.id === goalId);
    if (goal) {
      onGoalSet(goal.prompt, {
        goalType: goalId,
        goalTitle: goal.title,
        isCustom: false,
      });
      onClose();
    }
  };

  const handleCustomGoal = () => {
    if (customGoal.trim()) {
      onGoalSet(customGoal.trim(), {
        goalType: 'custom',
        goalTitle: 'Custom Goal',
        isCustom: true,
      });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            What would you like to accomplish today?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            I'm here to help you with your health questions. Let me know what
            you'd like to focus on, and I'll remember your goal throughout our
            conversation.
          </p>

          {!showCustom ? (
            <>
              <div className="grid gap-3">
                {COMMON_GOALS.map((goal) => {
                  const Icon = goal.icon;
                  return (
                    <Card
                      key={goal.id}
                      className={`p-4 cursor-pointer border-2 transition-all hover:border-blue-200 ${
                        selectedGoal === goal.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200'
                      }`}
                      onClick={() => handleGoalSelection(goal.id)}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-medium text-sm">{goal.title}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {goal.description}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCustom(true)}
                  className="w-full"
                >
                  Or describe your own goal
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">
                  Describe what you'd like help with:
                </label>
                <Textarea
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  placeholder="For example: I want to understand if my chest pain is serious, or I need help preparing questions for my cardiologist..."
                  className="mt-2 min-h-[100px]"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setShowCustom(false)} variant="outline">
                  Back to options
                </Button>
                <Button
                  onClick={handleCustomGoal}
                  disabled={!customGoal.trim()}
                  className="flex-1"
                >
                  Continue with this goal
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
