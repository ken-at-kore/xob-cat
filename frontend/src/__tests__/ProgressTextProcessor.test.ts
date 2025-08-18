/**
 * Tests for the Single Source of Truth Progress Text Processor
 */

import { 
  ProgressTextProcessor, 
  transformProgressText, 
  enableProgressDebug, 
  disableProgressDebug,
  getProgressLogs 
} from '../app/(dashboard)/analyze/ProgressTextProcessor';

describe('ProgressTextProcessor - Single Source of Truth', () => {
  let processor: ProgressTextProcessor;

  beforeEach(() => {
    processor = ProgressTextProcessor.getInstance();
    disableProgressDebug(); // Start with debug off
    processor.clearLogs(); // Clear after disabling debug to remove system logs
  });

  describe('Core Transformation Logic', () => {
    test('should handle discovery batch messages correctly', () => {
      const input = 'Processing discovery batch 1/1 (5 sessions)';
      const expected = 'Analyzing initial sessions (1/1)';
      const actual = transformProgressText(input, 'test');
      
      expect(actual).toBe(expected);
    });

    test('should handle initial parallel analysis correctly', () => {
      const input = 'Initializing parallel analysis...';
      const expected = 'Initializing';
      const actual = transformProgressText(input, 'test');
      
      expect(actual).toBe(expected);
    });

    test('should handle search window messages correctly', () => {
      const input = 'Searching in Initial 3-hour window...';
      const expected = 'Searching for sessions';
      const actual = transformProgressText(input, 'test');
      
      expect(actual).toBe(expected);
    });

    test('should handle conflict resolution correctly', () => {
      const input = 'Conflict resolution: Processing batch 2/3';
      const expected = 'Resolving conflicts (2/3)';
      const actual = transformProgressText(input, 'test');
      
      expect(actual).toBe(expected);
    });

    test('should handle parallel processing rounds correctly', () => {
      const input = 'Parallel processing: Round 1/3';
      const expected = 'Analyzing sessions: Round 1/3';
      const actual = transformProgressText(input, 'test');
      
      expect(actual).toBe(expected);
    });
  });

  describe('Logging and Debug Functionality', () => {
    test('should log transformations when debug is enabled', () => {
      enableProgressDebug();
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      transformProgressText('Processing discovery batch 1/1 (5 sessions)', 'test');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [ProgressTextProcessor] Discovery Batch Pattern:'),
        expect.any(Object)
      );
      
      consoleSpy.mockRestore();
      disableProgressDebug();
    });

    test('should not log transformations when debug is disabled', () => {
      disableProgressDebug();
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      transformProgressText('Processing discovery batch 1/1 (5 sessions)', 'test');
      
      // Should only log the debug mode change, not the transformation
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Discovery Batch Pattern'),
        expect.any(Object)
      );
      
      consoleSpy.mockRestore();
    });

    test('should maintain transformation logs', () => {
      transformProgressText('Processing discovery batch 1/1 (5 sessions)', 'test1');
      transformProgressText('Initializing parallel analysis...', 'test2');
      
      const logs = getProgressLogs();
      
      expect(logs).toHaveLength(2);
      expect(logs[0].input).toBe('Processing discovery batch 1/1 (5 sessions)');
      expect(logs[0].output).toBe('Analyzing initial sessions (1/1)');
      expect(logs[0].transformationType).toBe('Discovery Batch Pattern');
      expect(logs[1].input).toBe('Initializing parallel analysis...');
      expect(logs[1].output).toBe('Initializing');
      expect(logs[1].transformationType).toBe('Direct Mapping');
    });

    test('should include context in logs', () => {
      transformProgressText('Processing discovery batch 1/1 (5 sessions)', 'UI-Component-Test');
      
      const logs = getProgressLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].debugInfo?.context).toBe('UI-Component-Test');
    });
  });

  describe('Pattern Priority Testing', () => {
    test('should prioritize direct mappings over patterns', () => {
      // This tests that direct mappings take precedence
      const input = 'Initializing parallel analysis...';
      const result = transformProgressText(input, 'test');
      
      // Should use direct mapping, not generic parallel pattern
      expect(result).toBe('Initializing');
      
      const logs = getProgressLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].transformationType).toBe('Direct Mapping');
    });

    test('should fall back to generic patterns when no direct mapping exists', () => {
      const input = 'some parallel processing task';
      const result = transformProgressText(input, 'test');
      
      // Should use generic parallel pattern
      expect(result).toBe('Analyzing sessions');
      
      const logs = getProgressLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].transformationType).toBe('Generic Parallel');
    });

    test('should return original text when no pattern matches', () => {
      const input = 'completely unknown status message';
      const result = transformProgressText(input, 'test');
      
      expect(result).toBe(input);
      
      const logs = getProgressLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].transformationType).toBe('No Transform');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null/undefined input', () => {
      expect(transformProgressText(null as any)).toBe('Preparing analysis');
      expect(transformProgressText(undefined as any)).toBe('Preparing analysis');
      expect(transformProgressText('')).toBe('Preparing analysis');
    });

    test('should handle case sensitivity', () => {
      expect(transformProgressText('PROCESSING DISCOVERY BATCH 1/1')).toBe('Analyzing initial sessions');
      expect(transformProgressText('processing discovery batch 1/1')).toBe('Analyzing initial sessions');
    });
  });

  describe('Debug Export', () => {
    test('should export debug information', () => {
      transformProgressText('Processing discovery batch 1/1 (5 sessions)', 'test');
      
      const debugInfo = processor.exportDebugInfo();
      const parsed = JSON.parse(debugInfo);
      
      expect(parsed.totalLogs).toBe(1);
      expect(parsed.recentLogs).toHaveLength(1);
      expect(parsed.recentLogs[0].input).toBe('Processing discovery batch 1/1 (5 sessions)');
    });
  });
});