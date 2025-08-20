'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
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
import { calculateProgressPercentage, getPhaseLabel, resetProgressTracker } from './progressUtils';
import { transformProgressText, enableProgressDebug } from './ProgressTextProcessor';

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
    
    // Get botId from session storage to include in mock results
    let botId: string | undefined;
    try {
      const credentials = sessionStorage.getItem('botCredentials');
      if (credentials) {
        const parsed = JSON.parse(credentials);
        botId = parsed.botId;
      }
    } catch (error) {
      console.warn('Failed to get botId from sessionStorage:', error);
    }

    return {
      sessions,
      analysisSummary,
      botId
    };
  } catch (error) {
    console.error('Error loading mock results:', error);
    // Fallback to empty results if mock data can't be loaded
    return { sessions: [] };
  }
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

interface ConfigFormData {
  startDate: string;
  timeOfDay: TimeOfDay;
  sessionCount: number;
  openaiApiKey: string;
  modelId: string;
  additionalContext: string;
}

const TIME_MAPPINGS: Record<TimeOfDay, string> = {
  morning: '09:00',
  afternoon: '13:00',
  evening: '18:00'
};

const TIME_DISPLAY_OPTIONS = [
  { value: 'morning' as TimeOfDay, label: 'Morning (9:00 AM ET)' },
  { value: 'afternoon' as TimeOfDay, label: 'Afternoon (1:00 PM ET)' },
  { value: 'evening' as TimeOfDay, label: 'Evening (6:00 PM ET)' }
];

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
  showDevFeatures?: boolean;
}

export function AutoAnalyzeConfig({ onAnalysisStart, onShowMockReports, isLoadingMock = false, showDevFeatures = false }: AutoAnalyzeConfigProps) {
  // Enable progress text debug logging only when explicitly requested
  React.useEffect(() => {
    if (process.env.NEXT_PUBLIC_PROGRESS_DEBUG === 'true') {
      enableProgressDebug();
    }
  }, []);

  const [formData, setFormData] = useState<ConfigFormData>(() => {
    // Set default values
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 1); // Yesterday
    
    // Format as YYYY-MM-DD in local timezone (not UTC)
    const year = defaultDate.getFullYear();
    const month = String(defaultDate.getMonth() + 1).padStart(2, '0');
    const day = String(defaultDate.getDate()).padStart(2, '0');
    const localDateString = `${year}-${month}-${day}`;
    
    return {
      startDate: localDateString,
      timeOfDay: 'morning',
      sessionCount: 100,
      openaiApiKey: '',
      modelId: 'gpt-4.1', // Default to GPT-4.1 (base)
      additionalContext: ''
    };
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string>('');

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Validate session count
    if (formData.sessionCount < 5 || formData.sessionCount > 1000) {
      newErrors.sessionCount = 'Session count must be between 5 and 1000';
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

    // Time of day validation not needed since it's a controlled dropdown

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
        startTime: TIME_MAPPINGS[formData.timeOfDay],
        sessionCount: formData.sessionCount,
        openaiApiKey: formData.openaiApiKey,
        modelId: formData.modelId,
        ...(formData.additionalContext.trim() && { additionalContext: formData.additionalContext.trim() })
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
        <div className="mt-2 text-gray-600">
          <p className="mb-3">
            Auto-Analyze provides intelligent bot performance insights by automatically analyzing customer service sessions.
          </p>
          <ul className="space-y-2 list-disc list-inside">
            <li>The system uses smart session sampling (randomly selecting from available sessions in your specified timeframe)</li>
            <li>Applies advanced AI to extract insights and classify intents</li>
            <li>Generates comprehensive reports with actionable recommendations to help improve your bot's effectiveness and customer satisfaction</li>
          </ul>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Analysis Setup</CardTitle>
          <CardDescription>
            Configure your AI-powered analysis. The AI will automatically sample sessions from your selected 
            timeframe and provide detailed insights about user interactions and bot performance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {generalError && (
              <Alert variant="destructive">
                <AlertDescription>{generalError}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-4 items-start">
              <div className="space-y-2 flex-shrink-0" style={{width: "200px"}}>
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
                  Date to start searching for sessions (defaults to yesterday)
                </p>
              </div>

              <div className="space-y-2 flex-shrink-0" style={{width: "220px"}}>
                <Label htmlFor="timeOfDay">Time of Day</Label>
                <Select 
                  value={formData.timeOfDay} 
                  onValueChange={(value) => handleInputChange('timeOfDay', value as TimeOfDay)}
                >
                  <SelectTrigger id="timeOfDay">
                    <SelectValue placeholder="Select time of day" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_DISPLAY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Time of day to start searching for sessions
                </p>
              </div>
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
                Your OpenAI API key for AI analysis. This is not stored and only used for this analysis. 
                The cost can't be precisely determined in advance, but typically costs about 25 cents 
                depending on the length of the sessions analyzed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalContext">Additional Context & Instructions (Optional)</Label>
              <Textarea
                id="additionalContext"
                name="additionalContext"
                rows={2}
                maxLength={1500}
                placeholder="The bot is an Acme Labs IVA. It helps callers track lab results. Callers call a DTMF IVR first to get to this bot."
                value={formData.additionalContext}
                onChange={(e) => handleInputChange('additionalContext', e.target.value)}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">
                Provide context about your bot, company, or specific analysis instructions ({formData.additionalContext.length}/1500 characters)
              </p>
            </div>

            {/* Advanced Options Progressive Disclosure */}
            <div className="border-t pt-6">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-left w-full hover:text-gray-700 transition-colors"
              >
                <h4 className="font-medium text-gray-900">Advanced</h4>
                {showAdvanced ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
              
              {showAdvanced && (
                <div className="mt-4 space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="sessionCount">Number of Sessions</Label>
                    <Input
                      id="sessionCount"
                      name="sessionCount"
                      type="number"
                      min="5"
                      max="1000"
                      value={formData.sessionCount}
                      onChange={(e) => handleInputChange('sessionCount', parseInt(e.target.value) || 0)}
                      className={errors.sessionCount ? 'border-red-500' : ''}
                    />
                    {errors.sessionCount && (
                      <p className="text-sm text-red-600">{errors.sessionCount}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      Number of sessions to analyze (5-1000).
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
                  </div>
                </div>
              )}
            </div>

            {/* Line separator */}
            <div className="border-t pt-6">
              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Starting Analysis...' : 'Start Analysis'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Mock Reports Option - Only show when dev features are enabled */}
      {showDevFeatures && (
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
              {isLoadingMock ? 'Loading Mock Data...' : 'See Mock Report'}
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              This will display sample analysis results using mock data from real session transcripts, 
              allowing you to test the reporting interface without performing actual AI analysis.
            </p>
          </CardContent>
        </Card>
      )}
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


  React.useEffect(() => {
    let interval: NodeJS.Timeout;

    const fetchProgress = async () => {
      try {
        const response = await autoAnalyze.getProgress(analysisId);
        if (response.success && response.data) {
          // Debug: Log the progress data to console to see what's being received
          console.log('[Progress Debug] Received progress data:', JSON.stringify(response.data, null, 2));
          
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

  // Use the new improved progress calculation
  const progressPercentage = calculateProgressPercentage(progress);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analysis in Progress</h1>
        <p className="mt-2 text-gray-600">
          Your session analysis is running. This may take a minute or so.
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
        <CardContent className="pt-2">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">
              {transformProgressText(progress.currentStep, 'UI-AutoAnalyze-Progress')}
              {process.env.NEXT_PUBLIC_PROGRESS_DEBUG === 'true' && (
                <div className="text-xs text-red-500 mt-1">
                  [DEBUG] Raw: {progress.currentStep}
                </div>
              )}
            </div>
            <Progress value={progressPercentage} className="w-full" animated />
          </div>
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
  
  // Check if development features should be enabled
  const showDevFeatures = process.env.NEXT_PUBLIC_ENABLE_DEV_FEATURES === 'true';

  const handleAnalysisStart = (newAnalysisId: string) => {
    // Reset progress tracker for new analysis
    resetProgressTracker();
    setAnalysisId(newAnalysisId);
    setCurrentView('progress');
  };

  const handleAnalysisComplete = (analysisResults: AnalysisResults) => {
    setResults(analysisResults);
    setCurrentView('results');
  };

  const handleStartNew = () => {
    // Reset progress tracker for new analysis
    resetProgressTracker();
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
            showDevFeatures={showDevFeatures}
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