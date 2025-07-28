import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
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

interface AnalysisReportViewProps {
  results: AnalysisResults;
  onStartNew: () => void;
}

export function AnalysisReportView({ results, onStartNew }: AnalysisReportViewProps) {
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

  const filteredResults = results.sessions.filter(result => {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analysis Report</h1>
          <p className="mt-2 text-gray-600">
            Comprehensive analysis of {results.sessions.length} sessions with AI-powered insights and visualizations.
          </p>
        </div>
        <Button onClick={onStartNew}>Start New Analysis</Button>
      </div>

      {/* Top Row: Analysis Overview + Session Outcomes Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Analysis Overview */}
        {results.analysisSummary && (
          <Card>
            <CardHeader>
              <CardTitle>Analysis Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
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
          <CardContent>
            <div className="prose prose-sm max-w-none">
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
    </div>
  );
}