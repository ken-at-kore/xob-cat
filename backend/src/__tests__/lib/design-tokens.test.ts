/**
 * Design Tokens Unit Tests
 * 
 * Tests for design system constants including colors, fonts,
 * spacing, border radius, and typography definitions.
 */

import {
  colors,
  fontFamily,
  spacing,
  borderRadius,
  typography
} from '../../lib/design-tokens';

describe('Design Tokens', () => {
  describe('colors', () => {
    it('should define all required color tokens', () => {
      expect(colors).toHaveProperty('primary');
      expect(colors).toHaveProperty('grey');
      expect(colors).toHaveProperty('black');
    });

    it('should have valid hex color values', () => {
      expect(colors.primary).toBe('#2970FF');
      expect(colors.grey).toBe('#667085');
      expect(colors.black).toBe('#101828');
    });

    it('should use proper hex format', () => {
      const hexRegex = /^#[0-9A-F]{6}$/i;
      expect(colors.primary).toMatch(hexRegex);
      expect(colors.grey).toMatch(hexRegex);
      expect(colors.black).toMatch(hexRegex);
    });
  });

  describe('fontFamily', () => {
    it('should define font family tokens', () => {
      expect(fontFamily).toHaveProperty('sans');
    });

    it('should have valid CSS font stack', () => {
      expect(fontFamily.sans).toBe('"Inter", sans-serif');
    });

    it('should include fallback fonts', () => {
      expect(fontFamily.sans).toContain('sans-serif');
    });
  });

  describe('spacing', () => {
    it('should define all spacing tokens', () => {
      expect(spacing).toHaveProperty('s4');
      expect(spacing).toHaveProperty('s6');
      expect(spacing).toHaveProperty('s8');
      expect(spacing).toHaveProperty('s10');
    });

    it('should have correct rem values', () => {
      expect(spacing.s4).toBe('1rem');
      expect(spacing.s6).toBe('1.5rem');
      expect(spacing.s8).toBe('2rem');
      expect(spacing.s10).toBe('2.5rem');
    });

    it('should use consistent units', () => {
      const remRegex = /^\d+(\.\d+)?rem$/;
      expect(spacing.s4).toMatch(remRegex);
      expect(spacing.s6).toMatch(remRegex);
      expect(spacing.s8).toMatch(remRegex);
      expect(spacing.s10).toMatch(remRegex);
    });

    it('should follow progressive scale', () => {
      const values = [
        parseFloat(spacing.s4),
        parseFloat(spacing.s6), 
        parseFloat(spacing.s8),
        parseFloat(spacing.s10)
      ];
      
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]!);
      }
    });
  });

  describe('borderRadius', () => {
    it('should define all border radius tokens', () => {
      expect(borderRadius).toHaveProperty('sm');
      expect(borderRadius).toHaveProperty('md');
      expect(borderRadius).toHaveProperty('lg');
      expect(borderRadius).toHaveProperty('xl');
      expect(borderRadius).toHaveProperty('full');
    });

    it('should have correct rem values', () => {
      expect(borderRadius.sm).toBe('0.25rem');
      expect(borderRadius.md).toBe('0.375rem');
      expect(borderRadius.lg).toBe('0.5rem');
      expect(borderRadius.xl).toBe('0.75rem');
      expect(borderRadius.full).toBe('9999px');
    });

    it('should follow progressive scale (except full)', () => {
      const values = [
        parseFloat(borderRadius.sm),
        parseFloat(borderRadius.md), 
        parseFloat(borderRadius.lg),
        parseFloat(borderRadius.xl)
      ];
      
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]!);
      }
    });

    it('should have special full value for circles', () => {
      expect(borderRadius.full).toBe('9999px');
    });
  });

  describe('typography', () => {
    it('should define typography tokens', () => {
      expect(typography).toHaveProperty('heading');
      expect(typography).toHaveProperty('body');
    });

    describe('heading', () => {
      it('should have required properties', () => {
        expect(typography.heading).toHaveProperty('fontSize');
        expect(typography.heading).toHaveProperty('fontWeight');
        expect(typography.heading).toHaveProperty('lineHeight');
      });

      it('should have correct values', () => {
        expect(typography.heading.fontSize).toBe('1.5rem');
        expect(typography.heading.fontWeight).toBe(600);
        expect(typography.heading.lineHeight).toBe('2rem');
      });

      it('should have numeric font weight', () => {
        expect(typeof typography.heading.fontWeight).toBe('number');
        expect(typography.heading.fontWeight).toBeGreaterThan(0);
      });
    });

    describe('body', () => {
      it('should have required properties', () => {
        expect(typography.body).toHaveProperty('fontSize');
        expect(typography.body).toHaveProperty('fontWeight');
        expect(typography.body).toHaveProperty('lineHeight');
      });

      it('should have correct values', () => {
        expect(typography.body.fontSize).toBe('1rem');
        expect(typography.body.fontWeight).toBe(400);
        expect(typography.body.lineHeight).toBe('1.5rem');
      });

      it('should have numeric font weight', () => {
        expect(typeof typography.body.fontWeight).toBe('number');
        expect(typography.body.fontWeight).toBeGreaterThan(0);
      });
    });

    it('should have consistent line-height ratios', () => {
      const headingRatio = parseFloat(typography.heading.lineHeight) / parseFloat(typography.heading.fontSize);
      const bodyRatio = parseFloat(typography.body.lineHeight) / parseFloat(typography.body.fontSize);
      
      expect(headingRatio).toBeCloseTo(1.33, 2); // 32px / 24px ≈ 1.33
      expect(bodyRatio).toBe(1.5); // 24px / 16px = 1.5
    });

    it('should have proper font weight hierarchy', () => {
      expect(typography.heading.fontWeight).toBeGreaterThan(typography.body.fontWeight);
    });

    it('should have proper size hierarchy', () => {
      const headingSize = parseFloat(typography.heading.fontSize);
      const bodySize = parseFloat(typography.body.fontSize);
      expect(headingSize).toBeGreaterThan(bodySize);
    });
  });

  describe('Token consistency', () => {
    it('should use consistent unit types within categories', () => {
      // All spacing should use rem
      Object.values(spacing).forEach(value => {
        expect(value).toMatch(/rem$/);
      });

      // Most border radius should use rem (except full)
      const nonFullRadius = Object.entries(borderRadius)
        .filter(([key]) => key !== 'full')
        .map(([, value]) => value);
      
      nonFullRadius.forEach(value => {
        expect(value).toMatch(/rem$/);
      });
    });

    it('should maintain semantic naming conventions', () => {
      // Color names should describe purpose or brand
      expect(colors.primary).toBeDefined();
      expect(colors.grey).toBeDefined();
      expect(colors.black).toBeDefined();

      // Spacing should use consistent prefix
      Object.keys(spacing).forEach(key => {
        expect(key).toMatch(/^s\d+$/);
      });

      // Border radius should use size names
      const radiusKeys = Object.keys(borderRadius);
      expect(radiusKeys).toContain('sm');
      expect(radiusKeys).toContain('md');
      expect(radiusKeys).toContain('lg');
    });
  });
});