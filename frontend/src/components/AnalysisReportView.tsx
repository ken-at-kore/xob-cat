import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp, Filter, Share, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AnalysisResults, SessionWithFacts } from '@/shared/types';
import { 
  SessionOutcomePieChart, 
  TransferReasonsPareto, 
  DropOffLocationsBar, 
  GeneralIntentsBar,
  AnalysisCostCard 
} from './AnalysisCharts';
import { AnalyzedSessionDetailsDialog } from './AnalyzedSessionDetailsDialog';
import { ContainmentSuggestionCard } from './ContainmentSuggestionCard';
import { ShareReportModal } from './ShareReportModal';

// Centralized prose styling for consistent markdown rendering
const PROSE_CLASSES = "prose prose-sm max-w-none prose-headings:text-gray-900 prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:text-gray-700 prose-li:text-gray-700 prose-em:text-gray-600 prose-em:font-medium";

interface AnalysisReportViewProps {
  results: AnalysisResults;
  onStartNew: () => void;
  analysisId?: string; // Optional for report viewer mode
}

export function AnalysisReportView({ results, onStartNew, analysisId }: AnalysisReportViewProps) {
  const [sortField, setSortField] = useState<keyof SessionWithFacts | keyof SessionWithFacts['facts']>('session_id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterIntent, setFilterIntent] = useState<string>('all');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [filterTransferReason, setFilterTransferReason] = useState<string>('all');
  const [filterDropOffLocation, setFilterDropOffLocation] = useState<string>('all');
  const [selectedSessionIndex, setSelectedSessionIndex] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

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

  const handleDownload = async () => {
    if (!analysisId) return;
    
    try {
      // Note: We need to make a direct fetch since apiClient doesn't have this endpoint
      // But we need to manually add credential headers
      const credentials = sessionStorage.getItem('botCredentials');
      const credentialHeaders: Record<string, string> = {};
      
      if (credentials) {
        try {
          const parsed = JSON.parse(credentials);
          credentialHeaders['x-bot-id'] = parsed.botId;
          credentialHeaders['x-client-id'] = parsed.clientId;
          credentialHeaders['x-client-secret'] = parsed.clientSecret;
        } catch (error) {
          console.warn('Failed to parse stored credentials:', error);
        }
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/analysis/auto-analyze/parallel/export/${analysisId}`, {
        headers: {
          'x-jwt-token': localStorage.getItem('jwt-token') || 'default-token',
          ...credentialHeaders
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download analysis');
      }
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'xob-cat-analysis.json';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download analysis:', error);
      alert('Failed to download analysis report. Please try again.');
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedSessionIndex(null);
  };

  const handleNavigateSession = (newIndex: number) => {
    setSelectedSessionIndex(newIndex);
  };

  // Memoize filter options for performance
  const filterOptions = useMemo(() => {
    const intents = [...new Set(results.sessions.map(s => s.facts.generalIntent))]
      .filter(Boolean)
      .sort();
    const transferReasons = [...new Set(results.sessions
      .filter(s => s.facts.sessionOutcome === 'Transfer' && s.facts.transferReason)
      .map(s => s.facts.transferReason))]
      .filter(Boolean)
      .sort();
    const dropOffLocations = [...new Set(results.sessions
      .filter(s => s.facts.sessionOutcome === 'Transfer' && s.facts.dropOffLocation)
      .map(s => s.facts.dropOffLocation))]
      .filter(Boolean)
      .sort();
      
    return { intents, transferReasons, dropOffLocations };
  }, [results.sessions]);

  // Enhanced filtering logic
  const filteredResults = results.sessions.filter(result => {
    // Intent filter (exact match, skip if 'all')
    if (filterIntent && filterIntent !== 'all' && result.facts.generalIntent !== filterIntent) {
      return false;
    }
    
    // Outcome filter (exact match, skip if 'all')
    if (filterOutcome && filterOutcome !== 'all' && result.facts.sessionOutcome !== filterOutcome) {
      return false;
    }
    
    // Transfer-specific filters (only apply to Transfer sessions)
    if (result.facts.sessionOutcome === 'Transfer') {
      if (filterTransferReason && filterTransferReason !== 'all' && result.facts.transferReason !== filterTransferReason) {
        return false;
      }
      if (filterDropOffLocation && filterDropOffLocation !== 'all' && result.facts.dropOffLocation !== filterDropOffLocation) {
        return false;
      }
    }
    
    return true;
  });

  // Clear transfer-specific filters when outcome changes to Contained
  const handleOutcomeChange = (value: string) => {
    setFilterOutcome(value);
    if (value === 'Contained') {
      setFilterTransferReason('all');
      setFilterDropOffLocation('all');
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setFilterIntent('all');
    setFilterOutcome('all');
    setFilterTransferReason('all');
    setFilterDropOffLocation('all');
  };

  // Count active filters for progressive disclosure
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterIntent !== 'all') count++;
    if (filterOutcome !== 'all') count++;
    if (filterTransferReason !== 'all') count++;
    if (filterDropOffLocation !== 'all') count++;
    return count;
  }, [filterIntent, filterOutcome, filterTransferReason, filterDropOffLocation]);

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


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analysis Report</h1>
          {results.botId && (
            <div className="mt-1 flex items-center space-x-2">
              <span className="text-sm text-gray-500">Bot ID</span>
              <span className="text-sm font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded">
                {results.botId}
              </span>
            </div>
          )}
          <p className="mt-2 text-gray-600">
            Comprehensive analysis of {results.sessions.length} sessions with AI-powered insights and visualizations.
          </p>
        </div>
        <div className="flex gap-2">
          {analysisId && (
            <>
              <Button 
                onClick={handleDownload} 
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Report Data
              </Button>
              <Button 
                onClick={() => setIsShareModalOpen(true)} 
                variant="outline"
                className="flex items-center gap-2"
              >
                <Share className="h-4 w-4" />
                Share Report
              </Button>
            </>
          )}
          <Button onClick={onStartNew}>Start New Analysis</Button>
        </div>
      </div>

      {/* Top Row: Analysis Overview + Session Outcomes Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analysis Overview */}
        {results.analysisSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Analysis Overview</CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <div className={PROSE_CLASSES}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {results.analysisSummary.overview}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session Outcomes Area - Split into Pie Chart + Containment Suggestion */}
        <div className="space-y-6">
          {/* Session Outcomes Pie Chart (no legend) */}
          <SessionOutcomePieChart sessions={results.sessions} showLegend={false} />
          
          {/* Containment Improvement Suggestion */}
          {results.analysisSummary?.containmentSuggestion && (
            <ContainmentSuggestionCard suggestion={results.analysisSummary.containmentSuggestion} />
          )}
        </div>
      </div>

      {/* Transfer Reasons Pareto Chart */}
      <TransferReasonsPareto sessions={results.sessions} />

      {/* Bottom Charts Row: Drop-off Locations + General Intents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DropOffLocationsBar sessions={results.sessions} />
        <GeneralIntentsBar sessions={results.sessions} />
      </div>

      {/* Detailed Analysis Summary */}
      {results.analysisSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Analysis</CardTitle>
          </CardHeader>
          <CardContent className="px-8 py-6">
            <div className={`${PROSE_CLASSES} columns-2 gap-8 column-fill-balance`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {results.analysisSummary.summary}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Analysis */}
      <AnalysisCostCard sessions={results.sessions} />

      {/* Sessions Table */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Analyzed Sessions</h2>
        
        {/* Progressive Disclosure Filters */}
        <Card>
          {!filtersExpanded ? (
            /* Collapsed state - Compact single row */
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-500" />
                    <CardTitle className="text-base">Filter Sessions</CardTitle>
                  </div>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {activeFilterCount} active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {activeFilterCount > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleClearFilters}
                      className="text-xs text-gray-600 hover:text-gray-900"
                    >
                      Clear All
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFiltersExpanded(true)}
                    className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                  >
                    <span>Show Filters</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          ) : (
            /* Expanded state - Show all filters */
            <>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <CardTitle className="text-base">Filter Sessions</CardTitle>
                    </div>
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {activeFilterCount} active
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {activeFilterCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleClearFilters}
                        className="text-xs text-gray-600 hover:text-gray-900"
                      >
                        Clear All
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFiltersExpanded(false)}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900"
                    >
                      <span>Hide Filters</span>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* All filters in expanded state */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="filters-grid">
                  {/* Filter by Intent */}
                  <div className="space-y-2">
                    <Label htmlFor="filterIntent" className="text-sm font-medium">Intent</Label>
                    <Select value={filterIntent} onValueChange={setFilterIntent}>
                      <SelectTrigger id="filterIntent" className="w-full">
                        <SelectValue placeholder="All Intents" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Intents</SelectItem>
                        {filterOptions.intents.map(intent => (
                          <SelectItem key={intent} value={intent}>{intent}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filter by Outcome */}
                  <div className="space-y-2">
                    <Label htmlFor="filterOutcome" className="text-sm font-medium">Outcome</Label>
                    <Select value={filterOutcome} onValueChange={handleOutcomeChange}>
                      <SelectTrigger id="filterOutcome" className="w-full">
                        <SelectValue placeholder="All Outcomes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Outcomes</SelectItem>
                        <SelectItem value="Transfer">Transfer</SelectItem>
                        <SelectItem value="Contained">Contained</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filter by Transfer Reason */}
                  <div className="space-y-2">
                    <Label htmlFor="filterTransferReason" className="text-sm font-medium">Transfer Reason</Label>
                    <Select 
                      value={filterTransferReason} 
                      onValueChange={setFilterTransferReason}
                      disabled={filterOutcome === 'Contained'}
                    >
                      <SelectTrigger id="filterTransferReason" className="w-full">
                        <SelectValue placeholder="All Transfer Reasons" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Transfer Reasons</SelectItem>
                        {filterOptions.transferReasons.map(reason => (
                          <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Filter by Drop-off Location */}
                  <div className="space-y-2">
                    <Label htmlFor="filterDropOffLocation" className="text-sm font-medium">Drop-off Location</Label>
                    <Select 
                      value={filterDropOffLocation} 
                      onValueChange={setFilterDropOffLocation}
                      disabled={filterOutcome === 'Contained'}
                    >
                      <SelectTrigger id="filterDropOffLocation" className="w-full">
                        <SelectValue placeholder="All Drop-off Locations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Drop-off Locations</SelectItem>
                        {filterOptions.dropOffLocations.map(location => (
                          <SelectItem key={location} value={location}>{location}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        {/* Sessions Table */}
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
              <div className="text-2xl font-bold text-blue-600">{results.sessions.length}</div>
              <div className="text-sm text-gray-500">Total Sessions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {results.sessions.filter((r: SessionWithFacts) => r.facts.sessionOutcome === 'Contained').length}
              </div>
              <div className="text-sm text-gray-500">Contained</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-red-600">
                {results.sessions.filter((r: SessionWithFacts) => r.facts.sessionOutcome === 'Transfer').length}
              </div>
              <div className="text-sm text-gray-500">Transferred</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {[...new Set(results.sessions.map((r: SessionWithFacts) => r.facts.generalIntent))].length}
              </div>
              <div className="text-sm text-gray-500">Unique Intents</div>
            </CardContent>
          </Card>
        </div>
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

      {/* Share Report Modal */}
      {/* Additional Context (if provided) */}
      {results.additionalContext && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Analysis Context</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">{results.additionalContext}</p>
          </CardContent>
        </Card>
      )}

      <ShareReportModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        analysisId={analysisId}
      />
    </div>
  );
}