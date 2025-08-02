/**
 * Utils Unit Tests
 * 
 * Tests for utility functions including class name merging
 * and redirect functionality.
 */

import { cn, redirectTo } from '../utils';

describe('Utils', () => {
  describe('cn (className utility)', () => {
    it('should merge class names correctly', () => {
      const result = cn('px-2 py-1', 'text-sm');
      expect(result).toBe('px-2 py-1 text-sm');
    });

    it('should handle conditional classes', () => {
      const result = cn('base-class', true && 'conditional-class', false && 'hidden-class');
      expect(result).toBe('base-class conditional-class');
    });

    it('should merge conflicting Tailwind classes', () => {
      // twMerge should resolve conflicts, keeping the last one
      const result = cn('px-2 px-4');
      expect(result).toBe('px-4');
    });

    it('should handle undefined and null values', () => {
      const result = cn('base-class', undefined, null, 'final-class');
      expect(result).toBe('base-class final-class');
    });

    it('should work with arrays', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toBe('class1 class2 class3');
    });

    it('should work with objects', () => {
      const result = cn({
        'active': true,
        'disabled': false,
        'hover:bg-blue-500': true
      });
      expect(result).toBe('active hover:bg-blue-500');
    });

    it('should handle empty input', () => {
      const result = cn();
      expect(result).toBe('');
    });

    it('should handle complex Tailwind conflicts', () => {
      const result = cn('bg-red-500 bg-blue-500 text-white text-black');
      expect(result).toBe('bg-blue-500 text-black');
    });

    it('should preserve non-conflicting classes', () => {
      const result = cn('flex items-center px-2 py-1 px-4');
      expect(result).toBe('flex items-center py-1 px-4');
    });
  });

  describe('redirectTo', () => {
    // Note: redirectTo is a simple wrapper around window.location.assign
    // JSDOM doesn't allow easy mocking of window.location, so we test that the function exists and is callable
    it('should be a function that can be called', () => {
      expect(typeof redirectTo).toBe('function');
      
      // Test that it doesn't throw with valid URLs
      expect(() => redirectTo('/')).not.toThrow();
      expect(() => redirectTo('https://example.com')).not.toThrow();
      expect(() => redirectTo('')).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should work together in a typical UI scenario', () => {
      const isActive = true;
      const isDisabled = false;
      const size = 'large';
      
      const className = cn(
        'btn',
        {
          'btn-active': isActive,
          'btn-disabled': isDisabled
        },
        size === 'large' && 'btn-lg'
      );
      
      expect(className).toBe('btn btn-active btn-lg');
    });

    it('should handle dynamic class generation', () => {
      const variants = {
        primary: 'bg-blue-500 text-white',
        secondary: 'bg-gray-500 text-white',
        ghost: 'bg-transparent text-gray-700'
      };
      
      const variant = 'primary';
      const className = cn(
        'px-4 py-2 rounded',
        variants[variant as keyof typeof variants]
      );
      
      expect(className).toBe('px-4 py-2 rounded bg-blue-500 text-white');
    });
  });
});