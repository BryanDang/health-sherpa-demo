/**
 * Contract for ProgressiveDisclosure Component
 * Defines collapsible content areas with accessibility support
 */

export interface ProgressiveDisclosureContract {
  /**
   * Input: Configuration and content for progressive disclosure
   */
  inputs: {
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
  };

  /**
   * Output: Rendered component behavior and state
   */
  outputs: {
    /** Visual rendering */
    rendering: {
      /** Collapsible header with title and toggle indicator */
      header: {
        title: string;
        toggleIcon: 'ChevronDown' | 'ChevronUp';
        clickable: boolean;
        disabled: boolean;
      };

      /** Content area that expands/collapses */
      content: {
        visible: boolean;
        animated: boolean;
        accessible: boolean;
      };

      /** Overall component styling */
      styling: {
        variant: 'default' | 'medical' | 'emergency';
        interactive: boolean;
        focused: boolean;
      };
    };

    /** Component state */
    state: {
      expanded: boolean;
      disabled: boolean;
      animating: boolean;
    };

    /** Accessibility attributes */
    accessibility: {
      ariaExpanded: boolean;
      ariaControls: string;
      ariaLabel: string;
      ariaDescription?: string;
      tabIndex: number;
      role: string;
    };

    /** Event callbacks */
    events: {
      onToggleCallback?: (expanded: boolean) => void;
      onExpandCallback?: () => void;
      onCollapseCallback?: () => void;
    };
  };

  /**
   * Side effects: What happens when component is used
   */
  sideEffects: [
    'DOM re-renders when expanded state changes',
    'CSS animations trigger during expand/collapse',
    'Focus management updates for accessibility',
    'Callback functions execute on state change',
    'ARIA attributes update for screen readers',
    'Parent component may re-render if callbacks update state',
  ];

  /**
   * Failure modes: How this can fail
   */
  failureModes: [
    'Children prop is null/undefined causing render crash',
    'Animation gets stuck in intermediate state',
    'Keyboard navigation fails due to missing tabIndex',
    'Screen readers miss state changes due to missing ARIA',
    'Toggle function called on disabled component',
    'Memory leak from uncleaned event listeners',
    'CSS animations conflict with other styles',
    'Component crashes due to invalid variant prop',
    'onToggle callback throws exception breaking component',
    'Focus trap fails during keyboard navigation',
  ];

  /**
   * Dependencies: What this relies on
   */
  dependencies: [
    'React useState for expanded state management',
    'React useCallback for event handler optimization',
    'React useId for unique ARIA IDs',
    'Lucide React icons (ChevronDown, ChevronUp)',
    'Tailwind CSS for styling and animations',
    'CSS transitions for smooth expand/collapse',
    'ARIA standards for accessibility compliance',
  ];
}

/**
 * Type definitions for the contract
 */
export type ProgressiveDisclosureProps =
  ProgressiveDisclosureContract['inputs'];
export type ProgressiveDisclosureState =
  ProgressiveDisclosureContract['outputs']['state'];
export type ProgressiveDisclosureVariant = 'default' | 'medical' | 'emergency';
