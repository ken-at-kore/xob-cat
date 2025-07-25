'use client';

import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Progress } from '../../../components/ui/progress';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { 
  AnalysisConfig,
  AnalysisProgress,
  SessionWithFacts
} from '../../../../../shared/types';
import { autoAnalyze } from '../../../lib/api';
import { AnalyzedSessionDetailsDialog } from '../../../components/AnalyzedSessionDetailsDialog';

/**
 * Load mock analysis results for testing
 */
async function loadMockResults(): Promise<SessionWithFacts[]> {
  try {
    const response = await fetch('/api/mock-analysis-results');
    if (!response.ok) {
      throw new Error('Failed to load mock results');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading mock results:', error);
    // Fallback to empty array if mock data can't be loaded
    return [];
  }
}

interface ConfigFormData {
  startDate: string;
  startTime: string;
  sessionCount: number;
  openaiApiKey: string;
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
      openaiApiKey: ''
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
        openaiApiKey: formData.openaiApiKey
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
  onComplete: (results: SessionWithFacts[]) => void;
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

  const progressPercentage = progress.totalSessions > 0 
    ? (progress.sessionsProcessed / progress.totalSessions) * 100 
    : 0;

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
              {progress.phase.charAt(0).toUpperCase() + progress.phase.slice(1)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{progress.currentStep}</span>
              <span>{progress.sessionsProcessed} / {progress.totalSessions} sessions</span>
            </div>
            <Progress value={progressPercentage} className="w-full" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
 * Results Table Component
 * Displays analyzed sessions with extracted facts
 */
interface ResultsViewProps {
  results: SessionWithFacts[];
  onStartNew: () => void;
}

export function ResultsView({ results, onStartNew }: ResultsViewProps) {
  const [sortField, setSortField] = useState<keyof SessionWithFacts | keyof SessionWithFacts['facts']>('session_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterIntent, setFilterIntent] = useState<string>('');
  const [filterOutcome, setFilterOutcome] = useState<string>('');
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleSort = (field: keyof SessionWithFacts | keyof SessionWithFacts['facts']) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (sessionIndex: number) => {
    setSelectedSessionIndex(sessionIndex);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedSessionIndex(null);
  };

  const handleNavigateSession = (newIndex: number) => {
    setSelectedSessionIndex(newIndex);
  };

  const filteredResults = results.filter(result => {
    if (filterIntent && !result.facts.generalIntent.toLowerCase().includes(filterIntent.toLowerCase())) {
      return false;
    }
    if (filterOutcome && result.facts.sessionOutcome !== filterOutcome) {
      return false;
    }
    return true;
  });

  const sortedResults = [...filteredResults].sort((a, b) => {
    let aValue: any, bValue: any;
    
    if (sortField in a.facts) {
      aValue = a.facts[sortField as keyof SessionWithFacts['facts']];
      bValue = b.facts[sortField as keyof SessionWithFacts['facts']];
    } else {
      aValue = a[sortField as keyof SessionWithFacts];
      bValue = b[sortField as keyof SessionWithFacts];
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const outcomes = ['Transfer', 'Contained'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analysis Results</h1>
          <p className="mt-2 text-gray-600">
            {results.length} sessions analyzed with AI-extracted facts and insights.
          </p>
        </div>
        <Button onClick={onStartNew}>Start New Analysis</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="filterIntent">Filter by Intent</Label>
              <Input
                id="filterIntent"
                placeholder="Search intents..."
                value={filterIntent}
                onChange={(e) => setFilterIntent(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filterOutcome">Filter by Outcome</Label>
              <select
                id="filterOutcome"
                className="w-full p-2 border border-gray-300 rounded-md"
                value={filterOutcome}
                onChange={(e) => setFilterOutcome(e.target.value)}
              >
                <option value="">All Outcomes</option>
                {outcomes.map(outcome => (
                  <option key={outcome} value={outcome}>{outcome}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('session_id')}
                  >
                    Session ID
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('generalIntent')}
                  >
                    General Intent
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('sessionOutcome')}
                  >
                    Session Outcome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transfer Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Drop-off Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedResults.map((result, index) => (
                  <tr 
                    key={result.session_id} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleRowClick(index)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {result.session_id}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge variant="outline">{result.facts.generalIntent}</Badge>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge 
                        variant={result.facts.sessionOutcome === 'Transfer' ? 'destructive' : 'default'}
                      >
                        {result.facts.sessionOutcome}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {result.facts.transferReason || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {result.facts.dropOffLocation || '-'}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {result.facts.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{results.length}</div>
            <div className="text-sm text-gray-500">Total Sessions</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {results.filter(r => r.facts.sessionOutcome === 'Contained').length}
            </div>
            <div className="text-sm text-gray-500">Contained</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {results.filter(r => r.facts.sessionOutcome === 'Transfer').length}
            </div>
            <div className="text-sm text-gray-500">Transferred</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {[...new Set(results.map(r => r.facts.generalIntent))].length}
            </div>
            <div className="text-sm text-gray-500">Unique Intents</div>
          </CardContent>
        </Card>
      </div>

      {/* Session Details Dialog */}
      {selectedSessionIndex !== null && (
        <AnalyzedSessionDetailsDialog
          isOpen={isDialogOpen}
          onClose={handleCloseDialog}
          sessions={sortedResults}
          currentSessionIndex={selectedSessionIndex}
          onNavigate={handleNavigateSession}
        />
      )}
    </div>
  );
}

/**
 * Main Auto-Analyze Page Component
 * Manages the overall workflow and state transitions
 */
export default function AutoAnalyzePage() {
  const [currentView, setCurrentView] = useState<'config' | 'progress' | 'results'>('config');
  const [analysisId, setAnalysisId] = useState<string>('');
  const [results, setResults] = useState<SessionWithFacts[]>([]);
  const [isLoadingMock, setIsLoadingMock] = useState(false);

  const handleAnalysisStart = (newAnalysisId: string) => {
    setAnalysisId(newAnalysisId);
    setCurrentView('progress');
  };

  const handleAnalysisComplete = (analysisResults: SessionWithFacts[]) => {
    setResults(analysisResults);
    setCurrentView('results');
  };

  const handleStartNew = () => {
    setCurrentView('config');
    setAnalysisId('');
    setResults([]);
  };

  const handleShowMockReports = async () => {
    setIsLoadingMock(true);
    try {
      const mockResults = await loadMockResults();
      setResults(mockResults);
      setCurrentView('results');
    } catch (error) {
      console.error('Failed to load mock results:', error);
      // Could add error state here if needed
    } finally {
      setIsLoadingMock(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {currentView === 'config' && (
        <AutoAnalyzeConfig 
          onAnalysisStart={handleAnalysisStart}
          onShowMockReports={handleShowMockReports}
          isLoadingMock={isLoadingMock}
        />
      )}
      
      {currentView === 'progress' && analysisId && (
        <ProgressView 
          analysisId={analysisId}
          onComplete={handleAnalysisComplete}
        />
      )}
      
      {currentView === 'results' && results.length > 0 && (
        <ResultsView 
          results={results}
          onStartNew={handleStartNew}
        />
      )}
    </div>
  );
}