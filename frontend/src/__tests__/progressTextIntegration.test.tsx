/**
 * Integration tests to verify the single source of truth is working in UI components
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { transformProgressText, enableProgressDebug, getProgressLogs, ProgressTextProcessor } from '../app/(dashboard)/analyze/ProgressTextProcessor';

// Mock a simple component that uses the progress text transformation
function MockProgressComponent({ currentStep }: { currentStep: string }) {
  return (
    <div data-testid="progress-text">
      {transformProgressText(currentStep, 'UI-Test-Component')}
    </div>
  );
}

describe('Progress Text Integration', () => {
  beforeEach(() => {
    // Clear logs and disable debug mode for clean tests
    const processor = ProgressTextProcessor.getInstance();
    processor.clearLogs();
    processor.setDebugMode(false);
  });

  describe('UI Integration', () => {
    test('should transform discovery batch message correctly in UI component', () => {
      render(
        <MockProgressComponent currentStep="Processing discovery batch 1/1 (5 sessions)" />
      );
      
      expect(screen.getByTestId('progress-text')).toHaveTextContent('Analyzing initial sessions (1/1)');
    });

    test('should transform initial parallel analysis correctly in UI component', () => {
      render(
        <MockProgressComponent currentStep="Initializing parallel analysis..." />
      );
      
      expect(screen.getByTestId('progress-text')).toHaveTextContent('Initializing');
    });

    test('should transform search window messages correctly in UI component', () => {
      render(
        <MockProgressComponent currentStep="Searching in Initial 3-hour window..." />
      );
      
      expect(screen.getByTestId('progress-text')).toHaveTextContent('Searching for sessions');
    });
  });

  describe('Single Source of Truth Validation', () => {
    test('should log all transformations through single processor', () => {
      enableProgressDebug();
      
      // Render multiple components with different messages
      const { rerender } = render(
        <MockProgressComponent currentStep="Processing discovery batch 1/1 (5 sessions)" />
      );
      
      rerender(
        <MockProgressComponent currentStep="Initializing parallel analysis..." />
      );
      
      rerender(
        <MockProgressComponent currentStep="Searching in Initial 3-hour window..." />
      );
      
      // Check that all transformations went through the single processor
      const logs = getProgressLogs();
      
      // Filter out system logs to focus on transformations
      const transformationLogs = logs.filter(log => log.transformationType !== 'System');
      expect(transformationLogs).toHaveLength(3);
      
      expect(transformationLogs[0].input).toBe('Processing discovery batch 1/1 (5 sessions)');
      expect(transformationLogs[0].output).toBe('Analyzing initial sessions (1/1)');
      expect(transformationLogs[0].debugInfo?.context).toBe('UI-Test-Component');
      
      expect(transformationLogs[1].input).toBe('Initializing parallel analysis...');
      expect(transformationLogs[1].output).toBe('Initializing');
      expect(transformationLogs[1].debugInfo?.context).toBe('UI-Test-Component');
      
      expect(transformationLogs[2].input).toBe('Searching in Initial 3-hour window...');
      expect(transformationLogs[2].output).toBe('Searching for sessions');
      expect(transformationLogs[2].debugInfo?.context).toBe('UI-Test-Component');
    });

    test('should provide complete traceability from input to output', () => {
      enableProgressDebug();
      
      const testCases = [
        {
          input: 'Processing discovery batch 1/1 (5 sessions)',
          expectedOutput: 'Analyzing initial sessions (1/1)',
          expectedType: 'Discovery Batch Pattern'
        },
        {
          input: 'Initializing parallel analysis...',
          expectedOutput: 'Initializing',
          expectedType: 'Direct Mapping'
        },
        {
          input: 'some unknown parallel task',
          expectedOutput: 'Analyzing sessions',
          expectedType: 'Generic Parallel'
        }
      ];
      
      testCases.forEach(({ input, expectedOutput, expectedType }, index) => {
        const { unmount } = render(<MockProgressComponent currentStep={input} />);
        
        // Verify UI shows correct output (use getAllByTestId to handle multiple elements)
        const elements = screen.getAllByTestId('progress-text');
        expect(elements[elements.length - 1]).toHaveTextContent(expectedOutput);
        
        // Verify transformation was logged correctly
        const logs = getProgressLogs();
        const relevantLog = logs.find(log => log.input === input);
        
        expect(relevantLog).toBeDefined();
        expect(relevantLog!.output).toBe(expectedOutput);
        expect(relevantLog!.transformationType).toBe(expectedType);
        expect(relevantLog!.debugInfo?.context).toBe('UI-Test-Component');
        
        // Clean up
        unmount();
      });
    });
  });

  describe('Debugging Capability', () => {
    test('should provide debug export with complete transformation history', () => {
      enableProgressDebug();
      
      // Perform some transformations
      render(<MockProgressComponent currentStep="Processing discovery batch 1/1 (5 sessions)" />);
      render(<MockProgressComponent currentStep="Initializing parallel analysis..." />);
      
      const processor = ProgressTextProcessor.getInstance();
      const debugInfo = processor.exportDebugInfo();
      const parsed = JSON.parse(debugInfo);
      
      expect(parsed.debugMode).toBe(true);
      expect(parsed.totalLogs).toBeGreaterThan(0);
      expect(parsed.recentLogs).toBeInstanceOf(Array);
      expect(parsed.timestamp).toBeDefined();
      
      // Verify we can trace specific transformations
      const discoveryLog = parsed.recentLogs.find((log: any) => 
        log.input === 'Processing discovery batch 1/1 (5 sessions)'
      );
      
      expect(discoveryLog).toBeDefined();
      expect(discoveryLog.output).toBe('Analyzing initial sessions (1/1)');
      expect(discoveryLog.transformationType).toBe('Discovery Batch Pattern');
    });
  });
});