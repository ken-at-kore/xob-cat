/**
 * Tests to expose the current fragmented progress text processing architecture
 * These tests should reveal where different text transformations are happening
 */

import { getSimplifiedStatusText } from '../app/(dashboard)/analyze/progressUtils';

describe('Progress Text Processing Architecture Analysis', () => {
  describe('Current progressUtils.ts behavior', () => {
    test('should handle discovery batch messages correctly', () => {
      const input = 'Processing discovery batch 1/1 (5 sessions)';
      const expected = 'Analyzing initial sessions (1/1)';
      const actual = getSimplifiedStatusText(input);
      
      console.log('🔍 Discovery batch test:');
      console.log('  Input:', input);
      console.log('  Expected:', expected);
      console.log('  Actual:', actual);
      
      expect(actual).toBe(expected);
    });
    
    test('should handle initial parallel analysis correctly', () => {
      const input = 'Initializing parallel analysis...';
      const expected = 'Initializing';
      const actual = getSimplifiedStatusText(input);
      
      console.log('🔍 Initial analysis test:');
      console.log('  Input:', input);
      console.log('  Expected:', expected);
      console.log('  Actual:', actual);
      
      expect(actual).toBe(expected);
    });
    
    test('should handle search window messages correctly', () => {
      const input = 'Searching in Initial 3-hour window...';
      const expected = 'Searching for sessions';
      const actual = getSimplifiedStatusText(input);
      
      console.log('🔍 Search window test:');
      console.log('  Input:', input);
      console.log('  Expected:', expected);
      console.log('  Actual:', actual);
      
      expect(actual).toBe(expected);
    });
  });
  
  describe('Problematic cases that expose architecture issues', () => {
    test('should identify where "Initializing (1/1)" comes from', () => {
      // This test should help us understand why discovery batch becomes "Initializing (1/1)"
      const knownProblemInputs = [
        'Processing discovery batch 1/1 (5 sessions)',
        'discovery batch 1/1',
        'Processing discovery',
        'discovery batch',
      ];
      
      console.log('🚨 Testing problematic discovery inputs:');
      knownProblemInputs.forEach(input => {
        const result = getSimplifiedStatusText(input);
        console.log(`  "${input}" → "${result}"`);
        
        // If any of these return "Initializing (1/1)", we found the source
        if (result.includes('Initializing (') && result.includes('/')) {
          console.log(`  ⚠️ FOUND PROBLEM SOURCE: "${input}" produces "${result}"`);
        }
      });
    });
    
    test('should trace the regex patterns', () => {
      const input = 'Processing discovery batch 1/1 (5 sessions)';
      
      // Test the regex pattern directly
      const discoveryBatchRegex = /Processing discovery batch (\d+)\/(\d+)/;
      const match = input.match(discoveryBatchRegex);
      
      console.log('🔍 Regex pattern test:');
      console.log('  Input:', input);
      console.log('  Regex:', discoveryBatchRegex);
      console.log('  Match result:', match);
      
      if (match) {
        const expectedOutput = `Analyzing initial sessions (${match[1]}/${match[2]})`;
        console.log('  Should produce:', expectedOutput);
      }
      
      expect(match).not.toBeNull();
      expect(match![1]).toBe('1');
      expect(match![2]).toBe('1');
    });
  });
  
  describe('Architecture Discovery - Find all text processors', () => {
    test('should log execution flow for discovery batch', () => {
      // This test will help us see if progressUtils is being called at all
      const originalConsoleLog = console.log;
      const logs: string[] = [];
      
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalConsoleLog(...args);
      };
      
      try {
        const result = getSimplifiedStatusText('Processing discovery batch 1/1 (5 sessions)');
        
        console.log('🔍 Execution trace for discovery batch:');
        console.log('  Result:', result);
        console.log('  Logs captured:', logs.length);
        logs.forEach((log, i) => console.log(`    ${i + 1}. ${log}`));
        
      } finally {
        console.log = originalConsoleLog;
      }
    });
  });
});

/**
 * Integration tests to understand the full flow from API to UI
 */
describe('Progress Text Processing Integration', () => {
  test('should document the expected flow', () => {
    console.log('📋 Expected Progress Text Processing Flow:');
    console.log('  1. Backend sends: "Processing discovery batch 1/1 (5 sessions)"');
    console.log('  2. API transport: JSON over HTTP');
    console.log('  3. Frontend receives: progress.currentStep');
    console.log('  4. getSimplifiedStatusText() transforms: "Analyzing initial sessions (1/1)"');
    console.log('  5. UI displays: "Analyzing initial sessions (1/1)"');
    console.log('');
    console.log('🚨 Current Problem:');
    console.log('  - Backend sends correct message');
    console.log('  - UI shows "Initializing (1/1)" instead');
    console.log('  - Missing: visibility into transformation steps 2-4');
  });
});