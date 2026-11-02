/**
 * Unit Tests for Utils Library
 *
 * Tests pure utility functions to ensure they work correctly
 * in isolation with various input scenarios.
 */

import { cn } from '@/lib/utils';

describe('cn (className merger utility)', () => {
  describe('Basic functionality', () => {
    test('should merge simple class names', () => {
      const result = cn('text-red-500', 'bg-blue-100');
      expect(result).toBe('text-red-500 bg-blue-100');
    });

    test('should handle single class name', () => {
      const result = cn('text-center');
      expect(result).toBe('text-center');
    });

    test('should handle empty inputs', () => {
      const result = cn();
      expect(result).toBe('');
    });

    test('should handle undefined and null inputs', () => {
      const result = cn(undefined, null, 'valid-class');
      expect(result).toBe('valid-class');
    });
  });

  describe('Tailwind CSS class merging', () => {
    test('should merge non-conflicting Tailwind classes', () => {
      const result = cn('text-sm', 'text-red-500', 'bg-white', 'p-4');
      expect(result).toBe('text-sm text-red-500 bg-white p-4');
    });

    test('should handle conflicting Tailwind classes correctly', () => {
      // twMerge should resolve conflicts, keeping the last one
      const result = cn('text-sm', 'text-lg', 'text-xl');
      expect(result).toBe('text-xl'); // Should keep only the last text size
    });

    test('should merge padding classes correctly', () => {
      const result = cn('p-2', 'px-4'); // px-4 should override p-2's horizontal padding
      expect(result).toBe('p-2 px-4'); // twMerge actually keeps both when there's partial override
    });

    test('should handle background color conflicts', () => {
      const result = cn('bg-red-500', 'bg-blue-500', 'bg-green-500');
      expect(result).toBe('bg-green-500'); // Should keep only the last background
    });
  });

  describe('Conditional classes', () => {
    test('should handle boolean conditions', () => {
      const isActive = true;
      const isDisabled = false;

      const result = cn(
        'base-class',
        isActive && 'active-class',
        isDisabled && 'disabled-class'
      );

      expect(result).toBe('base-class active-class');
    });

    test('should handle mixed conditional and static classes', () => {
      const condition = false;
      const result = cn(
        'always-present',
        condition && 'conditional-class',
        'also-always'
      );
      expect(result).toBe('always-present also-always');
    });
  });

  describe('Object-style class definitions', () => {
    test('should handle object with boolean values', () => {
      const result = cn({
        'text-red-500': true,
        'bg-blue-100': false,
        'font-bold': true,
      });

      expect(result).toBe('text-red-500 font-bold');
    });

    test('should combine objects and strings', () => {
      const result = cn(
        'base-class',
        {
          'conditional-class': true,
          'hidden-class': false,
        },
        'final-class'
      );

      expect(result).toBe('base-class conditional-class final-class');
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle empty strings', () => {
      const result = cn('', '  ', 'valid-class', '');
      expect(result).toBe('valid-class');
    });

    test('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    test('should handle deeply nested conditions', () => {
      const config = {
        size: 'large',
        variant: 'primary',
        disabled: false,
      };

      const result = cn(
        'button',
        config.size === 'large' && 'text-lg',
        config.variant === 'primary' && 'bg-blue-500',
        config.disabled && 'opacity-50'
      );

      expect(result).toBe('button text-lg bg-blue-500');
    });
  });

  describe('Performance and complex scenarios', () => {
    test('should handle large number of classes efficiently', () => {
      const manyClasses = Array.from({ length: 100 }, (_, i) => `class-${i}`);
      const result = cn(...manyClasses);

      expect(result).toContain('class-0');
      expect(result).toContain('class-99');
      expect(typeof result).toBe('string');
    });

    test('should maintain consistent output for same inputs', () => {
      const inputs = ['text-red-500', 'bg-blue-100', 'p-4'];
      const result1 = cn(...inputs);
      const result2 = cn(...inputs);

      expect(result1).toBe(result2);
      expect(result1).toBe('text-red-500 bg-blue-100 p-4');
    });
  });

  describe('Real-world usage scenarios', () => {
    test('should work with component prop patterns', () => {
      // Simulate a React component props scenario
      const buttonProps = {
        variant: 'primary',
        size: 'lg',
        disabled: false,
        className: 'custom-button-class',
      };

      const result = cn(
        'base-button-styles',
        {
          'bg-blue-500 text-white': buttonProps.variant === 'primary',
          'bg-gray-500 text-gray-300': buttonProps.variant === 'secondary',
          'text-lg px-6 py-3': buttonProps.size === 'lg',
          'text-sm px-4 py-2': buttonProps.size === 'sm',
          'opacity-50 cursor-not-allowed': buttonProps.disabled,
        },
        buttonProps.className
      );

      expect(result).toBe(
        'base-button-styles bg-blue-500 text-white text-lg px-6 py-3 custom-button-class'
      );
    });

    test('should handle responsive design classes', () => {
      const result = cn(
        'text-sm',
        'md:text-base',
        'lg:text-lg',
        'grid grid-cols-1',
        'md:grid-cols-2',
        'lg:grid-cols-3'
      );

      expect(result).toBe(
        'text-sm md:text-base lg:text-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      );
    });
  });

  describe('Type safety and TypeScript integration', () => {
    test('should accept string literals', () => {
      const result = cn('text-red-500' as const);
      expect(result).toBe('text-red-500');
    });

    test('should work with template literals', () => {
      const color = 'red';
      const intensity = '500';
      const result = cn(`text-${color}-${intensity}`, 'font-bold');
      expect(result).toBe('text-red-500 font-bold');
    });
  });

  // Demonstration test that intentionally checks edge behavior
  describe('Edge behavior validation', () => {
    test('should demonstrate Tailwind merge behavior with conflicts', () => {
      // This test documents the expected behavior when conflicting classes are merged
      const result = cn('p-4', 'px-2', 'py-8');

      // twMerge behavior: keeps all classes since they don't directly conflict
      // p-4 applies to all sides, px-2 overrides x-axis, py-8 overrides y-axis
      // Result keeps: p-4 px-2 py-8 (CSS cascade handles the override)
      expect(result).toBe('p-4 px-2 py-8');
    });

    test('should handle whitespace normalization', () => {
      const result = cn('  text-center  ', '   bg-white   ', 'p-4');
      expect(result).toBe('text-center bg-white p-4');
      expect(result).not.toContain('  '); // Should not contain multiple spaces
    });
  });
});
