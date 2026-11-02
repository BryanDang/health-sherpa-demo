'use client';

import React, { useState, useCallback, useId, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * ProgressiveDisclosure Component
 * Collapsible content areas with medical-grade accessibility support
 * Based on WCAG 2.1 AA standards and clinical workflow requirements
 */

export interface ProgressiveDisclosureProps {
  /** Content configuration */
  title: string;
  children: React.ReactNode;

  /** Behavior configuration */
  defaultExpanded?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'medical' | 'emergency';

  /** Accessibility configuration */
  ariaLabel?: string;
  ariaDescription?: string;

  /** Event handlers */
  onToggle?: (expanded: boolean) => void;
  onExpand?: () => void;
  onCollapse?: () => void;

  /** Emergency override */
  emergencyOverride?: boolean;

  /** Additional styling */
  className?: string;
}

export function ProgressiveDisclosure({
  title,
  children,
  defaultExpanded = false,
  disabled = false,
  variant = 'default',
  ariaLabel,
  ariaDescription,
  onToggle,
  onExpand,
  onCollapse,
  emergencyOverride = false,
  className,
}: ProgressiveDisclosureProps) {
  // State management
  const [isExpanded, setIsExpanded] = useState(
    defaultExpanded || emergencyOverride
  );
  const [isAnimating, setIsAnimating] = useState(false);

  // Accessibility IDs
  const buttonId = useId();
  const contentId = useId();
  const descriptionId = useId();

  // Refs for accessibility and animation
  const contentRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Emergency override effect
  useEffect(() => {
    if (emergencyOverride && !isExpanded) {
      handleToggle();
    }
  }, [emergencyOverride]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle toggle with safety checks and callbacks
  const handleToggle = useCallback(() => {
    if (disabled || isAnimating) return;

    const newExpanded = !isExpanded;

    try {
      // Set animating state
      setIsAnimating(true);

      // Update expanded state
      setIsExpanded(newExpanded);

      // Call appropriate callbacks
      if (newExpanded && onExpand) {
        onExpand();
      } else if (!newExpanded && onCollapse) {
        onCollapse();
      }

      if (onToggle) {
        onToggle(newExpanded);
      }

      // Clear animating state after animation
      timeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, 300); // Match CSS animation duration
    } catch (error) {
      console.error('ProgressiveDisclosure toggle error:', error);
      // Reset animating state on error
      setIsAnimating(false);
    }
  }, [disabled, isAnimating, isExpanded, onExpand, onCollapse, onToggle]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  // Determine variant classes with enhanced accessibility
  const getVariantClasses = () => {
    switch (variant) {
      case 'emergency':
        return {
          container: 'border-red-600 bg-red-50 border-2 shadow-lg',
          header: 'bg-red-100 text-red-900 border-b border-red-200',
          button:
            'text-red-800 hover:text-red-900 hover:bg-red-200 transition-colors duration-200',
          content: 'bg-red-25 border-t border-red-200',
          focus: 'focus:ring-red-500 focus:border-red-600',
        };
      case 'medical':
        return {
          container: 'border-blue-400 bg-blue-50 shadow-md',
          header: 'bg-blue-100 text-blue-900 border-b border-blue-200',
          button:
            'text-blue-800 hover:text-blue-900 hover:bg-blue-200 transition-colors duration-200',
          content: 'bg-blue-25 border-t border-blue-200',
          focus: 'focus:ring-blue-500 focus:border-blue-600',
        };
      default:
        return {
          container: 'border-gray-400 bg-gray-50 shadow-sm',
          header: 'bg-gray-100 text-gray-900 border-b border-gray-200',
          button:
            'text-gray-800 hover:text-gray-900 hover:bg-gray-200 transition-colors duration-200',
          content: 'bg-white border-t border-gray-200',
          focus: 'focus:ring-blue-500 focus:border-blue-600',
        };
    }
  };

  const variantClasses = getVariantClasses();

  // Render loading/error states for children
  const renderContent = () => {
    if (!children) {
      return (
        <div className="text-gray-500 italic p-4">No content available</div>
      );
    }

    try {
      return children;
    } catch (error) {
      console.error('ProgressiveDisclosure content error:', error);
      return (
        <div className="text-red-600 p-4" role="alert">
          Error loading content. Please try again.
        </div>
      );
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden',
        'motion-safe:transition-all motion-safe:duration-300',
        'hover:shadow-md focus-within:shadow-lg',
        'contrast-more:border-2 contrast-more:border-current',
        variantClasses.container,
        emergencyOverride &&
          'emergency-override ring-2 ring-red-500 ring-offset-2',
        className
      )}
      data-variant={variant}
      data-expanded={isExpanded}
      data-testid="progressive-disclosure"
      data-high-contrast-ready="true"
      role="region"
      aria-labelledby={buttonId}
    >
      {/* Header with toggle button */}
      <div className={cn('px-4 py-3', variantClasses.header)}>
        <button
          id={buttonId}
          type="button"
          className={cn(
            'w-full flex items-center justify-between text-left font-medium',
            'focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-md px-2 py-1 -mx-2 -my-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'motion-safe:transition-all motion-safe:duration-200',
            variantClasses.button,
            variantClasses.focus,
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          aria-label={
            ariaLabel || `${isExpanded ? 'Collapse' : 'Expand'} ${title}`
          }
          aria-describedby={ariaDescription ? descriptionId : undefined}
          disabled={disabled}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          data-testid="disclosure-toggle"
        >
          <span className="text-sm sm:text-base">
            {title}
            {emergencyOverride && (
              <span className="ml-2 text-xs bg-red-600 text-white px-2 py-1 rounded-md font-bold shadow-sm">
                EMERGENCY
              </span>
            )}
          </span>

          {/* Toggle icon with accessibility text */}
          <span className="ml-2 flex items-center">
            {isExpanded ? (
              <>
                <ChevronUp
                  className="h-4 w-4 transition-transform duration-200"
                  data-testid="chevron-up"
                  aria-hidden="true"
                />
                <span className="sr-only">collapse</span>
              </>
            ) : (
              <>
                <ChevronDown
                  className="h-4 w-4 transition-transform duration-200"
                  data-testid="chevron-down"
                  aria-hidden="true"
                />
                <span className="sr-only">expand</span>
              </>
            )}
          </span>
        </button>

        {/* Optional description for screen readers */}
        {ariaDescription && (
          <div id={descriptionId} className="sr-only">
            {ariaDescription}
          </div>
        )}
      </div>

      {/* Collapsible content */}
      <div
        id={contentId}
        ref={contentRef}
        className={cn(
          'overflow-hidden',
          'motion-safe:transition-all motion-safe:duration-300 motion-safe:ease-in-out',
          'motion-reduce:transition-none',
          isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0',
          isExpanded ? 'visible' : 'invisible'
        )}
        aria-hidden={!isExpanded}
        data-testid={isExpanded ? 'expanded-content' : 'collapsed-content'}
        inert={!isExpanded ? true : undefined}
      >
        <div className={cn('p-4', variantClasses.content)}>
          {isExpanded && renderContent()}
        </div>
      </div>

      {/* Emergency mode indicator */}
      {emergencyOverride && (
        <div className="sr-only" role="alert" aria-live="assertive">
          Emergency mode: All information displayed
        </div>
      )}

      {/* Live region for expansion state changes */}
      <div className="sr-only" role="status" aria-live="polite">
        {isAnimating && `${title} ${isExpanded ? 'expanded' : 'collapsed'}`}
      </div>
    </div>
  );
}

export default ProgressiveDisclosure;
