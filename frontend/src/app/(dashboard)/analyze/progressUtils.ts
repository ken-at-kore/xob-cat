import { AnalysisProgress, ParallelAnalysisProgress } from '@/shared/types';

/**
 * Maps verbose technical status messages to user-friendly text
 */
export function getSimplifiedStatusText(currentStep: string): string {
  // Handle null/undefined
  if (!currentStep) return 'Preparing analysis';

  // Direct mappings for common statuses
  const mappings: Record<string, string> = {
    'Initializing parallel analysis': 'Initializing analysis',
    'Initializing analysis': 'Initializing analysis',
    'Searching in Initial 3-hour window': 'Searching for sessions',
    'Searching in Initial 3 hour window': 'Searching for sessions',
    'Searching in 6-hour window': 'Searching for sessions',
    'Searching in 12-hour window': 'Searching for sessions',
    'Searching in 6-day window': 'Searching for sessions',
    'Generating summary with AI': 'Generating analysis summary',
    'Analysis complete': 'Analysis complete',
    'Starting parallel analysis': 'Starting analysis',
  };

  // Check direct mappings first
  if (mappings[currentStep]) {
    return mappings[currentStep];
  }

  // Pattern-based mappings
  
  // "Processing discovery batch X/Y (Z sessions)" -> "Analyzing initial sessions (X/Y)"
  const discoveryBatchMatch = currentStep.match(/Processing discovery batch (\d+)\/(\d+)/);
  if (discoveryBatchMatch) {
    return `Analyzing initial sessions (${discoveryBatchMatch[1]}/${discoveryBatchMatch[2]})`;
  }

  // "Parallel processing: Round X/Y" -> "Analyzing sessions: Round X/Y"
  const parallelRoundMatch = currentStep.match(/Parallel processing: Round (\d+)\/(\d+)/);
  if (parallelRoundMatch) {
    return `Analyzing sessions: Round ${parallelRoundMatch[1]}/${parallelRoundMatch[2]}`;
  }

  // "Conflict resolution after round X" -> "Consolidating classifications: Round X"
  const conflictRoundMatch = currentStep.match(/Conflict resolution after round (\d+)/);
  if (conflictRoundMatch) {
    return `Consolidating classifications: Round ${conflictRoundMatch[1]}`;
  }

  // "Conflict resolution complete (round X)" -> "Classifications consolidated: Round X"
  const conflictCompleteMatch = currentStep.match(/Conflict resolution complete \(round (\d+)\)/);
  if (conflictCompleteMatch) {
    return `Classifications consolidated: Round ${conflictCompleteMatch[1]}`;
  }

  // Generic searching patterns
  if (currentStep.toLowerCase().includes('searching')) {
    return 'Searching for sessions';
  }

  // Generic discovery patterns
  if (currentStep.toLowerCase().includes('discovery')) {
    return 'Analyzing initial sessions';
  }

  // Generic parallel processing
  if (currentStep.toLowerCase().includes('parallel')) {
    return 'Analyzing sessions';
  }

  // Generic conflict resolution
  if (currentStep.toLowerCase().includes('conflict') || currentStep.toLowerCase().includes('consolidat')) {
    return 'Consolidating classifications';
  }

  // Generic summary generation
  if (currentStep.toLowerCase().includes('summary')) {
    return 'Generating analysis summary';
  }

  // Default fallback - return a cleaned version of the original
  return currentStep;
}

/**
 * Calculates progress percentage with improved accuracy for all phases
 * including inter-round conflict resolution
 */
export function calculateProgressPercentage(progress: AnalysisProgress | ParallelAnalysisProgress): number {
  // Phase weights - must add up to 100
  const phaseWeights = {
    sampling: 20,           // 0-20%
    discovery: 15,          // 20-35%
    parallel_processing: 50, // 35-85%
    conflict_resolution: 10, // 85-95%
    generating_summary: 5    // 95-100%
  };

  let baseProgress = 0;

  // Handle 'complete' phase
  if (progress.phase === 'complete') {
    return 100;
  }

  // Handle error phase
  if (progress.phase === 'error') {
    // Return progress where it stopped
    return baseProgress;
  }

  // Calculate sampling phase progress
  if (progress.phase === 'sampling') {
    // Check for message retrieval progress (detailed sampling)
    if ('messageProgress' in progress && progress.messageProgress) {
      const messageProgress = progress.messageProgress;
      const retrievalProgress = messageProgress.totalSessions > 0
        ? messageProgress.sessionsWithMessages / messageProgress.totalSessions
        : 0;
      
      // Sampling is 50% finding sessions, 50% retrieving messages
      const findProgress = progress.samplingProgress 
        ? Math.min(progress.sessionsFound / progress.samplingProgress.targetSessionCount, 1) * 0.5
        : 0.5;
      
      const totalSamplingProgress = findProgress + (retrievalProgress * 0.5);
      return Math.round(totalSamplingProgress * phaseWeights.sampling);
    } 
    
    // Original sampling logic
    if (progress.samplingProgress) {
      const windowProgressWeight = 0.6;
      const sessionProgressWeight = 0.4;
      
      const windowProgress = progress.samplingProgress.currentWindowIndex / progress.samplingProgress.totalWindows;
      const sessionProgress = Math.min(progress.sessionsFound / progress.samplingProgress.targetSessionCount, 1);
      
      const samplingProgress = (windowProgress * windowProgressWeight) + (sessionProgress * sessionProgressWeight);
      return Math.round(samplingProgress * phaseWeights.sampling);
    }
    
    // Fallback for sampling
    if (progress.sessionsFound > 0) {
      const basicProgress = Math.min(progress.sessionsFound / 100, 0.5);
      return Math.round(basicProgress * phaseWeights.sampling);
    }
    
    return 2; // Minimal progress if in sampling
  }

  // Add completed sampling phase
  if (['discovery', 'parallel_processing', 'conflict_resolution', 'generating_summary'].includes(progress.phase)) {
    baseProgress += phaseWeights.sampling;
  }

  // Calculate discovery phase progress
  if (progress.phase === 'discovery') {
    const discoveryProgress = ('discoveryStats' in progress && progress.discoveryStats)
      ? Math.min(progress.discoveryStats.discoveryRate || 0, 1)
      : 0.3; // Default 30% if in discovery
    
    return Math.round(baseProgress + (discoveryProgress * phaseWeights.discovery));
  }

  // Add completed discovery phase
  if (['parallel_processing', 'conflict_resolution', 'generating_summary'].includes(progress.phase)) {
    baseProgress += phaseWeights.discovery;
  }

  // Calculate parallel processing progress
  if (progress.phase === 'parallel_processing') {
    const parallelProgress = progress as ParallelAnalysisProgress;
    
    // Check if we're in inter-round conflict resolution
    if (progress.currentStep?.includes('Conflict resolution') || 
        progress.currentStep?.includes('Consolidating classifications')) {
      // During conflict resolution, add extra progress based on round completion
      const roundProgress = parallelProgress.totalRounds > 0
        ? (parallelProgress.roundsCompleted || 0) / parallelProgress.totalRounds
        : 0;
      
      // Add 5% bonus for being in conflict resolution
      const conflictBonus = 0.05;
      const totalProgress = Math.min(roundProgress + conflictBonus, 1);
      
      return Math.round(baseProgress + (totalProgress * phaseWeights.parallel_processing));
    }
    
    // Normal parallel processing
    const roundProgress = parallelProgress.totalRounds > 0
      ? (parallelProgress.roundsCompleted || 0) / parallelProgress.totalRounds
      : 0;
    
    const sessionProgress = progress.totalSessions > 0
      ? progress.sessionsProcessed / progress.totalSessions
      : 0;
    
    // Use the higher of round or session progress
    const parallelProgressValue = Math.max(roundProgress, sessionProgress);
    return Math.round(baseProgress + (parallelProgressValue * phaseWeights.parallel_processing));
  }

  // Add completed parallel processing
  if (['conflict_resolution', 'generating_summary'].includes(progress.phase)) {
    baseProgress += phaseWeights.parallel_processing;
  }

  // Calculate final conflict resolution progress
  if (progress.phase === 'conflict_resolution') {
    const conflictProgress = ('conflictStats' in progress && progress.conflictStats)
      ? 0.5 // 50% through conflict resolution when active
      : 0.3;
    
    return Math.round(baseProgress + (conflictProgress * phaseWeights.conflict_resolution));
  }

  // Add completed conflict resolution
  if (progress.phase === 'generating_summary') {
    baseProgress += phaseWeights.conflict_resolution;
  }

  // Calculate summary generation progress
  if (progress.phase === 'generating_summary') {
    return Math.round(baseProgress + (0.5 * phaseWeights.generating_summary));
  }

  // Legacy 'analyzing' phase support
  if (progress.phase === 'analyzing') {
    const sessionProgress = progress.totalSessions > 0
      ? progress.sessionsProcessed / progress.totalSessions
      : 0;
    
    return Math.round(
      phaseWeights.sampling + 
      phaseWeights.discovery + 
      (sessionProgress * phaseWeights.parallel_processing)
    );
  }

  // Fallback - return at least 1% if analysis is running
  return Math.max(Math.round(baseProgress), 1);
}

/**
 * Gets the user-friendly phase label for the badge
 */
export function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    'sampling': 'Sampling',
    'discovery': 'Discovery',
    'parallel_processing': 'Processing',
    'conflict_resolution': 'Resolving',
    'generating_summary': 'Summarizing',
    'analyzing': 'Analyzing',
    'complete': 'Complete',
    'error': 'Error'
  };
  
  return labels[phase] || 'Processing';
}