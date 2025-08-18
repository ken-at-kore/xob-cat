/**
 * Single Source of Truth for Progress Text Transformation
 * 
 * This centralized processor:
 * 1. Handles ALL progress text transformations
 * 2. Provides explicit logging of every transformation
 * 3. Tracks the complete transformation pipeline
 * 4. Exposes debug information for troubleshooting
 */

export interface ProgressTextLog {
  timestamp: number;
  input: string;
  output: string;
  transformationType: string;
  matchedPattern?: string;
  debugInfo?: any;
}

export class ProgressTextProcessor {
  private static instance: ProgressTextProcessor;
  private logs: ProgressTextLog[] = [];
  private debugMode: boolean = false;

  static getInstance(): ProgressTextProcessor {
    if (!ProgressTextProcessor.instance) {
      ProgressTextProcessor.instance = new ProgressTextProcessor();
    }
    return ProgressTextProcessor.instance;
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    this.log('System', `Debug mode ${enabled ? 'enabled' : 'disabled'}`, '', '');
  }

  forceDebugMode(): void {
    this.debugMode = true;
  }

  private log(transformationType: string, input: string, output: string, matchedPattern: string = '', debugInfo: any = {}): void {
    const logEntry: ProgressTextLog = {
      timestamp: Date.now(),
      input,
      output,
      transformationType,
      matchedPattern,
      debugInfo
    };
    
    this.logs.push(logEntry);
    
    if (this.debugMode) {
      console.log(`🔍 [ProgressTextProcessor] ${transformationType}:`, JSON.stringify({
        input,
        output,
        matchedPattern,
        debugInfo
      }, null, 2));
    }
  }

  /**
   * SINGLE SOURCE OF TRUTH: All progress text goes through this method
   */
  transform(input: string, context: string = 'unknown'): string {
    // Debug mode is controlled by setDebugMode() or environment variables
    // No longer forced on for debugging

    if (!input) {
      this.log('Empty Input', input || 'null/undefined', 'Preparing analysis', '', { context });
      return 'Preparing analysis';
    }

    // Direct mappings for common statuses (highest priority)
    const directMappings: Record<string, string> = {
      'Initializing parallel analysis': 'Initializing analysis',
      'Initializing parallel analysis...': 'Initializing',
      'Initializing analysis': 'Initializing analysis',
      'Searching in Initial 3-hour window': 'Searching for sessions',
      'Searching in Initial 3-hour window...': 'Searching for sessions',
      'Searching in 6-hour window': 'Searching for sessions',
      'Searching in 6-hour window...': 'Searching for sessions',
      'Searching in 12-hour window': 'Searching for sessions',
      'Searching in 12-hour window...': 'Searching for sessions',
      'Searching in 6-day window': 'Searching for sessions',
      'Searching in 6-day window...': 'Searching for sessions',
      'Found sufficient sessions (152), completing search...': 'Found sufficient sessions, completing search',
      'Generating analysis summary...': 'Generating analysis report',
      'Analysis completed successfully': 'Analysis completed successfully',
    };

    // Check direct mappings first
    if (directMappings[input]) {
      const output = directMappings[input];
      this.log('Direct Mapping', input, output, input, { context });
      return output;
    }

    // Pattern-based mappings (secondary priority)
    
    // "Processing discovery batch X/Y (Z sessions)" -> "Analyzing initial sessions (X/Y)"
    const discoveryBatchMatch = input.match(/Processing discovery batch (\d+)\/(\d+)/);
    if (discoveryBatchMatch) {
      const output = `Analyzing initial sessions (${discoveryBatchMatch[1]}/${discoveryBatchMatch[2]})`;
      this.log('Discovery Batch Pattern', input, output, 'Processing discovery batch (\\d+)/(\\d+)', { 
        context,
        groups: discoveryBatchMatch 
      });
      return output;
    }

    // "Parallel processing: Round X/Y" -> "Analyzing sessions: Round X/Y"
    const parallelRoundMatch = input.match(/Parallel processing: Round (\d+)\/(\d+)/);
    if (parallelRoundMatch) {
      const output = `Analyzing sessions: Round ${parallelRoundMatch[1]}/${parallelRoundMatch[2]}`;
      this.log('Parallel Round Pattern', input, output, 'Parallel processing: Round (\\d+)/(\\d+)', { 
        context,
        groups: parallelRoundMatch 
      });
      return output;
    }

    // "Conflict resolution: Processing batch X/Y" -> "Resolving conflicts (X/Y)"
    const conflictBatchMatch = input.match(/Conflict resolution: Processing batch (\d+)\/(\d+)/);
    if (conflictBatchMatch) {
      const output = `Resolving conflicts (${conflictBatchMatch[1]}/${conflictBatchMatch[2]})`;
      this.log('Conflict Batch Pattern', input, output, 'Conflict resolution: Processing batch (\\d+)/(\\d+)', { 
        context,
        groups: conflictBatchMatch 
      });
      return output;
    }

    // Generic keyword-based mappings (lowest priority)
    
    // Generic discovery patterns
    if (input.toLowerCase().includes('discovery')) {
      const output = 'Analyzing initial sessions';
      this.log('Generic Discovery', input, output, 'contains "discovery"', { context });
      return output;
    }

    // Generic parallel processing
    if (input.toLowerCase().includes('parallel')) {
      const output = 'Analyzing sessions';
      this.log('Generic Parallel', input, output, 'contains "parallel"', { context });
      return output;
    }

    // Generic conflict resolution
    if (input.toLowerCase().includes('conflict')) {
      const output = 'Resolving conflicts';
      this.log('Generic Conflict', input, output, 'contains "conflict"', { context });
      return output;
    }

    // Searching patterns
    if (input.toLowerCase().includes('searching') || input.toLowerCase().includes('search')) {
      const output = 'Searching for sessions';
      this.log('Generic Search', input, output, 'contains "search"', { context });
      return output;
    }

    // Summary generation
    if (input.toLowerCase().includes('summary') || input.toLowerCase().includes('generating')) {
      const output = 'Generating analysis report';
      this.log('Generic Summary', input, output, 'contains "summary" or "generating"', { context });
      return output;
    }

    // Fallback: return original text
    this.log('No Transform', input, input, 'no pattern matched', { context });
    return input;
  }

  /**
   * Get all transformation logs for debugging
   */
  getLogs(): ProgressTextLog[] {
    return [...this.logs];
  }

  /**
   * Get recent logs (last N entries)
   */
  getRecentLogs(count: number = 10): ProgressTextLog[] {
    return this.logs.slice(-count);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    if (this.debugMode) {
      console.log('🔍 [ProgressTextProcessor] Logs cleared');
    }
  }

  /**
   * Get logs for a specific input
   */
  getLogsForInput(input: string): ProgressTextLog[] {
    return this.logs.filter(log => log.input === input);
  }

  /**
   * Export debug information
   */
  exportDebugInfo(): string {
    return JSON.stringify({
      debugMode: this.debugMode,
      totalLogs: this.logs.length,
      recentLogs: this.getRecentLogs(20),
      timestamp: new Date().toISOString()
    }, null, 2);
  }
}

/**
 * Convenience function for the single source of truth
 * This replaces the old getSimplifiedStatusText function
 */
export function transformProgressText(input: string, context: string = 'unknown'): string {
  return ProgressTextProcessor.getInstance().transform(input, context);
}

/**
 * Debug helper to enable logging
 */
export function enableProgressDebug(): void {
  ProgressTextProcessor.getInstance().setDebugMode(true);
}

/**
 * Debug helper to disable logging
 */
export function disableProgressDebug(): void {
  ProgressTextProcessor.getInstance().setDebugMode(false);
}

/**
 * Debug helper to get logs
 */
export function getProgressLogs(): ProgressTextLog[] {
  return ProgressTextProcessor.getInstance().getLogs();
}