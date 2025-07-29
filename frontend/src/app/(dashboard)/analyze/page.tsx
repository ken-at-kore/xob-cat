'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Progress } from '../../../components/ui/progress';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { 
  AnalysisConfig,
  AnalysisProgress,
  SessionWithFacts,
  AnalysisResults,
  AnalysisSummary,
  GPT_MODELS,
  GptModel,
  getGptModelById
} from '../../../../../shared/types';
import { autoAnalyze } from '../../../lib/api';
import { AnalyzedSessionDetailsDialog } from '../../../components/AnalyzedSessionDetailsDialog';
import { AnalysisReportView } from '../../../components/AnalysisReportView';

/**
 * Load mock analysis results for testing
 */
async function loadMockResults(): Promise<AnalysisResults> {
  try {
    const sessionsResponse = await fetch('/api/mock-analysis-results');
    if (!sessionsResponse.ok) {
      throw new Error('Failed to load mock sessions');
    }
    const sessions: SessionWithFacts[] = await sessionsResponse.json();

    // Load the analysis summary
    const summaryResponse = await fetch('/api/mock-analysis-summary');
    let analysisSummary: AnalysisSummary | undefined;
    
    try {
      if (summaryResponse.ok) {
        analysisSummary = await summaryResponse.json();
      }
    } catch (error) {
      console.warn('Failed to load mock analysis summary:', error);
    }
    
    return {
      sessions,
      analysisSummary
    };
  } catch (error) {
    console.error('Error loading mock results:', error);
    // Fallback to empty results if mock data can't be loaded
    return { sessions: [] };
  }
}

interface ConfigFormData {
  startDate: string;
  startTime: string;
  sessionCount: number;
  openaiApiKey: string;
  modelId: string;
}

interface ValidationErrors {
  [key: string]: string;
}

/**
 * Auto-Analyze Configuration Component
 * Provides form for configuring automated session analysis
 */
interface AutoAnalyzeConfigProps {
  onAnalysisStart: (analysisId: string) => void;
  onShowMockReports: () => void;
  isLoadingMock?: boolean;
}

export function AutoAnalyzeConfig({ onAnalysisStart, onShowMockReports, isLoadingMock = false }: AutoAnalyzeConfigProps) {
  const [formData, setFormData] = useState<ConfigFormData>(() => {
    // Set default values
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 7); // 7 days ago
    
    return {
      startDate: defaultDate.toISOString().split('T')[0],
      startTime: '09:00',
      sessionCount: 100,
      openaiApiKey: '',
      modelId: 'gpt-4.1' // Default to GPT-4.1 (base)
    };
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string>('');

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Validate session count
    if (formData.sessionCount < 10 || formData.sessionCount > 1000) {
      newErrors.sessionCount = 'Session count must be between 10 and 1000';
    }

    // Validate OpenAI API key
    if (!formData.openaiApiKey) {
      newErrors.openaiApiKey = 'OpenAI API key is required';
    } else if (!formData.openaiApiKey.startsWith('sk-')) {
      newErrors.openaiApiKey = 'Invalid OpenAI API key format';
    }

    // Validate date is in past
    const selectedDate = new Date(formData.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate >= today) {
      newErrors.startDate = 'Date must be in the past';
    }

    // Validate time format
    if (!/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(formData.startTime)) {
      newErrors.startTime = 'Invalid time format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setGeneralError('');

    try {
      const config: AnalysisConfig = {
        startDate: formData.startDate,
        startTime: formData.startTime,
        sessionCount: formData.sessionCount,
        openaiApiKey: formData.openaiApiKey,
        modelId: formData.modelId
      };

      const response = await autoAnalyze.startAnalysis(config);
      
      if (response.success && response.data) {
        onAnalysisStart(response.data.analysisId);
      } else {
        setGeneralError(response.error || 'Failed to start analysis');
      }
    } catch (error: any) {
      setGeneralError(error.message || 'Failed to start analysis');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ConfigFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auto-Analyze</h1>
        <p className="mt-2 text-gray-600">
          Comprehensive bot performance analysis that randomly samples sessions from specified time periods 
          and applies AI-powered fact extraction to generate actionable insights.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Analysis Configuration</CardTitle>
          <CardDescription>
            Configure your automated session analysis. The system will intelligently expand time windows 
            to find sufficient sessions and maintain classification consistency across batches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {generalError && (
              <Alert variant="destructive">
                <AlertDescription>{generalError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className={errors.startDate ? 'border-red-500' : ''}
                />
                {errors.startDate && (
                  <p className="text-sm text-red-600">{errors.startDate}</p>
                )}
                <p className="text-xs text-gray-500">
                  Date to start searching for sessions (defaults to 7 days ago)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time (Eastern Time)</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value)}
                  className={errors.startTime ? 'border-red-500' : ''}
                />
                {errors.startTime && (
                  <p className="text-sm text-red-600">{errors.startTime}</p>
                )}
                <p className="text-xs text-gray-500">
                  Time to start searching (defaults to 9:00 AM ET)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionCount">Number of Sessions</Label>
              <Input
                id="sessionCount"
                name="sessionCount"
                type="number"
                min="10"
                max="1000"
                value={formData.sessionCount}
                onChange={(e) => handleInputChange('sessionCount', parseInt(e.target.value) || 0)}
                className={errors.sessionCount ? 'border-red-500' : ''}
              />
              {errors.sessionCount && (
                <p className="text-sm text-red-600">{errors.sessionCount}</p>
              )}
              <p className="text-xs text-gray-500">
                Number of sessions to analyze (10-1000). Analyzing more than 1000 sessions isn't allowed. 
                If fewer than 10 sessions are found, the analysis won't proceed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelId">GPT Model</Label>
              <Select 
                value={formData.modelId} 
                onValueChange={(value) => handleInputChange('modelId', value)}
              >
                <SelectTrigger id="modelId">
                  <SelectValue placeholder="Select a GPT model" />
                </SelectTrigger>
                <SelectContent>
                  {GPT_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Choose the GPT model for analysis. GPT-4.1 (base) provides the best balance of cost and accuracy.
              </p>
              {(() => {
                const selectedModel = getGptModelById(formData.modelId);
                if (!selectedModel) return null;
                
                return (
                  <div className="bg-gray-50 p-3 rounded-lg text-sm">
                    <div className="font-medium text-gray-900 mb-2">{selectedModel.name} Pricing</div>
                    <div className="space-y-1 text-gray-600">
                      <div className="flex justify-between">
                        <span>Input:</span>
                        <span>${selectedModel.inputPricePerMillion.toFixed(2)}/1M tokens</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Output:</span>
                        <span>${selectedModel.outputPricePerMillion.toFixed(2)}/1M tokens</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
              <Input
                id="openaiApiKey"
                name="openaiApiKey"
                type="password"
                placeholder="sk-..."
                value={formData.openaiApiKey}
                onChange={(e) => handleInputChange('openaiApiKey', e.target.value)}
                className={errors.openaiApiKey ? 'border-red-500' : ''}
              />
              {errors.openaiApiKey && (
                <p className="text-sm text-red-600">{errors.openaiApiKey}</p>
              )}
              <p className="text-xs text-gray-500">
                Your OpenAI API key for GPT-4o-mini analysis. This is not stored and only used for this analysis.
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">How Auto-Analyze Works</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Smart Session Sampling:</strong> Searches 3-hour initial window, expands to 6-hour → 12-hour → 6-day as needed</li>
                <li>• <strong>AI-Powered Analysis:</strong> Uses GPT-4o-mini to extract general intent, session outcome, transfer reasons, and drop-off locations</li>
                <li>• <strong>Classification Consistency:</strong> Maintains consistent classifications across all batches using iterative learning</li>
                <li>• <strong>Cost Efficient:</strong> Typically costs less than $2.00 for 100 sessions analyzed</li>
              </ul>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Starting Analysis...' : 'Start Analysis'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Mock Reports Option */}
      <Card>
        <CardHeader>
          <CardTitle>Development & Testing</CardTitle>
          <CardDescription>
            Skip the analysis step and view sample reports with mock data for development and testing purposes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline" 
            onClick={onShowMockReports}
            className="w-full"
            disabled={isLoadingMock}
          >
            {isLoadingMock ? 'Loading Mock Data...' : 'See Mock Reports'}
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            This will display sample analysis results using mock data from real session transcripts, 
            allowing you to test the reporting interface without performing actual AI analysis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Progress Tracking Component
 * Shows real-time progress during analysis
 */
interface ProgressViewProps {
  analysisId: string;
  onComplete: (results: AnalysisResults) => void;
}

export function ProgressView({ analysisId, onComplete }: ProgressViewProps) {
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [error, setError] = useState<string>('');

  const getPhaseLabel = (phase: string): string => {
    switch (phase) {
      case 'sampling': return 'Sampling';
      case 'analyzing': return 'Analyzing';
      case 'generating_summary': return 'Generating Summary';
      case 'complete': return 'Complete';
      case 'error': return 'Error';
      default: return phase.charAt(0).toUpperCase() + phase.slice(1);
    }
  };

  React.useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchProgress = async () => {
      try {
        const response = await autoAnalyze.getProgress(analysisId);
        if (response.success && response.data) {
          setProgress(response.data);
          
          if (response.data.phase === 'complete') {
            // Fetch results
            const resultsResponse = await autoAnalyze.getResults(analysisId);
            if (resultsResponse.success && resultsResponse.data) {
              onComplete(resultsResponse.data);
            }
            clearInterval(interval);
          } else if (response.data.phase === 'error') {
            setError(response.data.error || 'Analysis failed');
            clearInterval(interval);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to fetch progress');
        clearInterval(interval);
      }
    };

    // Initial fetch
    fetchProgress();

    // Poll every 2 seconds
    interval = setInterval(fetchProgress, 2000);

    return () => clearInterval(interval);
  }, [analysisId, onComplete]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!progress) {
    return <div>Loading...</div>;
  }

  const progressPercentage = (() => {
    // Calculate total workflow steps: session collection + batches + summary generation
    const totalBatches = progress.totalBatches || 1;
    const totalWorkflowSteps = 1 + totalBatches + 1; // collection + batches + summary
    const stepSize = 100 / totalWorkflowSteps;
    
    if (progress.phase === 'sampling') {
      // During sampling: show partial progress toward first step completion
      if (progress.samplingProgress) {
        // Show gradual progress during sampling (0% to stepSize%)
        const windowProgressWeight = 0.6;
        const sessionProgressWeight = 0.4;
        
        const windowProgress = (progress.samplingProgress.currentWindowIndex / progress.samplingProgress.totalWindows);
        const sessionProgress = Math.min(progress.sessionsFound / progress.samplingProgress.targetSessionCount, 1);
        
        const samplingProgress = (windowProgress * windowProgressWeight) + (sessionProgress * sessionProgressWeight);
        return Math.min(samplingProgress * stepSize, stepSize);
      }
      return 0;
    } else if (progress.phase === 'analyzing') {
      // Session collection complete (1 step) + completed batches + current batch progress
      const collectionComplete = stepSize;
      const completedBatchesProgress = progress.batchesCompleted * stepSize;
      
      // Calculate current batch progress
      const sessionsInCurrentBatch = Math.min(progress.sessionsProcessed - (progress.batchesCompleted * 5), 5);
      const currentBatchProgress = (sessionsInCurrentBatch / 5) * stepSize;
      
      return collectionComplete + completedBatchesProgress + currentBatchProgress;
    } else if (progress.phase === 'generating_summary') {
      // Collection + all batches complete, working on summary
      const collectionAndBatchesComplete = (1 + totalBatches) * stepSize;
      return collectionAndBatchesComplete + (stepSize * 0.5); // 50% through summary
    } else if (progress.phase === 'complete') {
      return 100;
    }
    
    return 0;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analysis in Progress</h1>
        <p className="mt-2 text-gray-600">
          Your session analysis is running. This may take a few minutes depending on the number of sessions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Progress</span>
            <Badge variant={progress.phase === 'error' ? 'destructive' : 'default'}>
              {getPhaseLabel(progress.phase)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{progress.currentStep}</span>
              <span>
                {progress.phase === 'sampling' && progress.samplingProgress
                  ? `${progress.sessionsFound} / ${progress.samplingProgress.targetSessionCount} sessions • Window ${progress.samplingProgress.currentWindowIndex + 1} / ${progress.samplingProgress.totalWindows}`
                  : progress.phase === 'sampling' 
                    ? `${progress.sessionsFound} sessions found`
                    : progress.phase === 'analyzing'
                      ? `Batch ${progress.batchesCompleted + 1} / ${progress.totalBatches} • ${progress.sessionsProcessed} / ${progress.totalSessions} sessions`
                      : progress.phase === 'generating_summary'
                        ? 'Generating analysis summary...'
                        : `${progress.sessionsProcessed} / ${progress.totalSessions} sessions`
                }
              </span>
            </div>
            <Progress value={progressPercentage} className="w-full" />
            {progress.phase === 'sampling' && progress.samplingProgress && (
              <div className="text-xs text-gray-500 mt-1">
                Current window: {progress.samplingProgress.currentWindowLabel}
              </div>
            )}
            {progress.totalBatches > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                Workflow: Session Collection → {progress.totalBatches} Analysis Batch{progress.totalBatches !== 1 ? 'es' : ''} → Summary Generation
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{progress.sessionsFound}</div>
              <div className="text-sm text-gray-500">Sessions Found</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{progress.batchesCompleted}</div>
              <div className="text-sm text-gray-500">Batches Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{progress.tokensUsed.toLocaleString()}</div>
              <div className="text-sm text-gray-500">Tokens Used</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">${progress.estimatedCost.toFixed(4)}</div>
              <div className="text-sm text-gray-500">Estimated Cost</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {progress.modelId ? getGptModelById(progress.modelId)?.name || progress.modelId : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">GPT Model</div>
            </div>
          </div>

          {progress.eta && progress.eta > 0 && (
            <div className="text-center text-sm text-gray-500">
              Estimated time remaining: {Math.ceil(progress.eta / 60)} minute{Math.ceil(progress.eta / 60) !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Results View Component - now simply delegates to AnalysisReportView
 */
interface ResultsViewProps {
  results: AnalysisResults;
  onStartNew: () => void;
  analysisId?: string;
}

export function ResultsView({ results, onStartNew, analysisId }: ResultsViewProps) {
  return <AnalysisReportView results={results} onStartNew={onStartNew} analysisId={analysisId} />;
}

/**
 * Main Auto-Analyze Page Component
 * Manages the overall workflow and state transitions
 */
export default function AutoAnalyzePage() {
  const [currentView, setCurrentView] = useState<'config' | 'progress' | 'results'>('config');
  const [analysisId, setAnalysisId] = useState<string>('');
  const [results, setResults] = useState<AnalysisResults>({ sessions: [] });
  const [isLoadingMock, setIsLoadingMock] = useState(false);

  const handleAnalysisStart = (newAnalysisId: string) => {
    setAnalysisId(newAnalysisId);
    setCurrentView('progress');
  };

  const handleAnalysisComplete = (analysisResults: AnalysisResults) => {
    setResults(analysisResults);
    setCurrentView('results');
  };

  const handleStartNew = () => {
    setCurrentView('config');
    setAnalysisId('');
    setResults({ sessions: [] });
  };

  const handleShowMockReports = async () => {
    setIsLoadingMock(true);
    try {
      const mockResults = await loadMockResults();
      setResults(mockResults);
      // Set a mock analysisId so the download button appears
      setAnalysisId('mock-analysis-' + Date.now());
      setCurrentView('results');
    } catch (error) {
      console.error('Failed to load mock results:', error);
      // Could add error state here if needed
    } finally {
      setIsLoadingMock(false);
    }
  };

  return (
    <>
      {currentView === 'config' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <AutoAnalyzeConfig 
            onAnalysisStart={handleAnalysisStart}
            onShowMockReports={handleShowMockReports}
            isLoadingMock={isLoadingMock}
          />
        </div>
      )}
      
      {currentView === 'progress' && analysisId && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ProgressView 
            analysisId={analysisId}
            onComplete={handleAnalysisComplete}
          />
        </div>
      )}
      
      {currentView === 'results' && results.sessions.length > 0 && (
        <ResultsView 
          results={results}
          onStartNew={handleStartNew}
          analysisId={analysisId}
        />
      )}
    </>
  );
}