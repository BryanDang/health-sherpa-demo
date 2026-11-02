'use client';

import React from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useTokenState } from '@/store/hooks';

interface TokenCounterProps {
  className?: string;
  compact?: boolean;
}

export default function TokenCounter({
  className = '',
  compact = false,
}: TokenCounterProps) {
  const {
    sessionInputTokens,
    sessionOutputTokens,
    sessionTotalTokens,
    sessionCost,
    tokenLimit,
    getUsagePercentage,
    isNearLimit,
    apiCalls,
  } = useTokenState();

  const usagePercentage = getUsagePercentage();
  const nearLimit = isNearLimit();
  const totalCalls = apiCalls.length;

  if (compact) {
    return (
      <div className={`flex items-center space-x-2 text-xs ${className}`}>
        <Activity className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">
          {sessionTotalTokens.toLocaleString()} tokens
        </span>
        {nearLimit && <AlertCircle className="h-3 w-3 text-amber-600" />}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-sm">
          <Activity className="h-4 w-4 mr-2 text-primary" />
          Token Usage
          {nearLimit && (
            <Badge variant="outline" className="ml-2 text-xs text-amber-600">
              Near Limit
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Token Breakdown */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Input tokens:</span>
            <span className="font-medium">
              {sessionInputTokens.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Output tokens:</span>
            <span className="font-medium">
              {sessionOutputTokens.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-xs border-t pt-2">
            <span className="font-medium">Total tokens:</span>
            <span className="font-medium">
              {sessionTotalTokens.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Usage Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Session progress:</span>
            <span className="text-muted-foreground">
              {sessionTotalTokens.toLocaleString()} /{' '}
              {tokenLimit.toLocaleString()}
            </span>
          </div>
          <Progress
            value={usagePercentage}
            className={`h-1.5 ${nearLimit ? 'text-amber-600' : ''}`}
          />
          <div className="text-xs text-muted-foreground">
            {usagePercentage.toFixed(1)}% of session limit
          </div>
        </div>

        {/* Cost & Stats */}
        <div className="space-y-1 pt-2 border-t">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Estimated cost:</span>
            <span className="font-medium text-green-600">
              ${sessionCost.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">API calls:</span>
            <span className="font-medium">{totalCalls}</span>
          </div>
        </div>

        {/* Warning */}
        {nearLimit && (
          <div className="bg-amber-50 border border-amber-200 rounded p-2">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-3 w-3 text-amber-600" />
              <span className="text-xs text-amber-800">
                Approaching session token limit
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
