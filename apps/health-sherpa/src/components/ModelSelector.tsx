'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bot,
  Brain,
  Search,
  Eye,
  Heart,
  Zap,
  ChevronDown,
  Check,
  Settings,
} from 'lucide-react';
// Simplified model configs for display only
const MODEL_CONFIGS = {
  gemini: {
    model: 'Gemini 2.0 Flash',
    capabilities: {
      search: true,
      vision: true,
      medical: true,
      reasoning: true,
    },
  },
} as const;

type ModelProvider = 'gemini';

/**
 * ModelSelector - Dynamic AI model selection component
 *
 * Features:
 * - Visual model comparison
 * - Capability indicators
 * - Real-time switching
 * - Future-ready for new models
 */
export function ModelSelector() {
  const [currentModel, setCurrentModel] = useState<ModelProvider>('gemini');
  const [isOpen, setIsOpen] = useState(false);

  const handleModelChange = (provider: ModelProvider) => {
    // Model switching handled via API routes in production
    setCurrentModel(provider);
    setIsOpen(false);
  };

  const getModelIcon = (provider: ModelProvider) => {
    const icons = {
      gemini: Bot,
      openai: Brain,
      medgemma: Heart,
    };
    return icons[provider] || Bot;
  };

  const getProviderColor = (provider: ModelProvider) => {
    const colors = {
      gemini: 'text-blue-600 bg-blue-50 border-blue-200',
      openai: 'text-green-600 bg-green-50 border-green-200',
      medgemma: 'text-red-600 bg-red-50 border-red-200',
    };
    return colors[provider] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getCapabilityIcon = (
    capability: keyof typeof MODEL_CONFIGS.gemini.capabilities
  ) => {
    const icons = {
      search: Search,
      vision: Eye,
      medical: Heart,
      reasoning: Brain,
    };
    return icons[capability];
  };

  const renderCapabilities = (provider: ModelProvider) => {
    const config = MODEL_CONFIGS[provider];
    return Object.entries(config.capabilities).map(([capability, enabled]) => {
      const Icon = getCapabilityIcon(
        capability as keyof typeof config.capabilities
      );
      return (
        <div
          key={capability}
          className={`flex items-center space-x-1 text-xs ${
            enabled ? 'text-green-600' : 'text-gray-400'
          }`}
        >
          <Icon className="h-3 w-3" />
          <span className="capitalize">{capability}</span>
          {enabled && <Check className="h-2 w-2" />}
        </div>
      );
    });
  };

  const currentConfig = MODEL_CONFIGS[currentModel];
  const CurrentIcon = getModelIcon(currentModel);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <CurrentIcon className="h-4 w-4" />
          <span className="capitalize">{currentModel}</span>
          <Badge variant="secondary" className="text-xs">
            AI Model
          </Badge>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="text-center">
          AI Model Selection
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Current Model Info */}
        <div
          className={`p-3 rounded-md border ${getProviderColor(currentModel)} mb-2`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <CurrentIcon className="h-4 w-4" />
              <span className="font-semibold capitalize">{currentModel}</span>
              <Badge variant="outline" className="text-xs">
                Current
              </Badge>
            </div>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {currentConfig.model}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {renderCapabilities(currentModel)}
          </div>
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Available Models</DropdownMenuLabel>

        {/* Model Options */}
        {Object.entries(MODEL_CONFIGS).map(([provider, config]) => {
          const isSelected = provider === currentModel;
          const ModelIcon = getModelIcon(provider as ModelProvider);

          return (
            <DropdownMenuItem
              key={provider}
              onClick={() => handleModelChange(provider as ModelProvider)}
              className={`p-3 cursor-pointer ${isSelected ? 'bg-accent' : ''}`}
            >
              <div className="flex items-start justify-between w-full">
                <div className="flex items-start space-x-3">
                  <ModelIcon className="h-4 w-4 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium capitalize">{provider}</span>
                      {isSelected && (
                        <Check className="h-3 w-3 text-green-600" />
                      )}
                      {provider === 'gemini' && (
                        <Badge
                          variant="outline"
                          className="text-xs text-green-600 border-green-600"
                        >
                          Active
                        </Badge>
                      )}
                      {provider !== 'gemini' && (
                        <Badge
                          variant="outline"
                          className="text-xs text-gray-500"
                        >
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {config.model}
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-2">
                      {renderCapabilities(provider as ModelProvider)}
                    </div>
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        {/* Model Settings */}
        <DropdownMenuItem className="p-2">
          <Settings className="mr-2 h-4 w-4" />
          <span>Model Settings</span>
          <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
