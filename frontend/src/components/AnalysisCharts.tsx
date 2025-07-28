/**
 * @file AnalysisCharts.tsx
 * @description Data visualization components for XOB CAT analysis reports using Nivo charts
 * 
 * This module provides interactive charts for visualizing bot performance metrics:
 * - Session outcomes (contained vs transferred)
 * - Transfer reasons with Pareto analysis
 * - User drop-off locations
 * - General user intents
 * - Cost analysis and token usage
 * 
 * All charts use the @nivo library for consistent, responsive, and accessible visualizations.
 */

import React from 'react';
import { ResponsiveBar } from '@nivo/bar';
import { ResponsivePie } from '@nivo/pie';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { SessionWithFacts } from '@/shared/types';

// Constants
const TEXT_TRUNCATION_LENGTH = 25;
const MAX_BAR_ITEMS = 8;
const MAX_PARETO_ITEMS = 10;

/**
 * Color palette for consistent chart styling across the application
 */
const COLORS = {
  primary: '#3B82F6',    // Blue - Primary bars
  secondary: '#EF4444',  // Red - Negative outcomes
  success: '#10B981',    // Green - Positive outcomes
  warning: '#F59E0B',    // Amber - Drop-offs
  info: '#6366F1',       // Indigo - General intents
  purple: '#8B5CF6',     // Purple
  orange: '#F97316',     // Orange
  teal: '#14B8A6',       // Teal
  pink: '#EC4899',       // Pink
  gray: '#6B7280'        // Gray
};

// Pie chart colors ordered for optimal visual contrast
const PIE_COLORS = [COLORS.success, COLORS.secondary, COLORS.warning, COLORS.info, COLORS.purple];

interface ChartProps {
  sessions: SessionWithFacts[];
}

/**
 * Truncates text to a maximum length with ellipsis
 */
const truncateText = (text: string, maxLength: number = TEXT_TRUNCATION_LENGTH): string => {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

/**
 * SessionOutcomePieChart - Visualizes the distribution of session outcomes
 * 
 * @component
 * @param {SessionWithFacts[]} sessions - Array of analyzed sessions
 * @param {boolean} showLegend - Whether to show the legend below the chart
 * @returns {JSX.Element} Pie chart showing percentage of contained vs transferred sessions
 * 
 * Features:
 * - Interactive pie slices with hover effects
 * - Percentage labels on each slice
 * - Optional color-coded legend below the chart
 * - Tooltips showing exact counts and percentages
 */
export function SessionOutcomePieChart({ sessions, showLegend = true }: ChartProps & { showLegend?: boolean }) {
  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Outcomes</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-gray-500">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const outcomeData = sessions.reduce((acc, session) => {
    const outcome = session.facts.sessionOutcome;
    acc[outcome] = (acc[outcome] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(outcomeData).map(([outcome, count], index) => ({
    id: outcome,
    label: outcome,
    value: count,
    percentage: ((count / sessions.length) * 100).toFixed(1),
    color: PIE_COLORS[index % PIE_COLORS.length]
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Outcomes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsivePie
            data={chartData}
            margin={{ top: 20, right: 80, bottom: 20, left: 80 }}
            innerRadius={0.5}
            padAngle={0.7}
            cornerRadius={3}
            activeOuterRadiusOffset={8}
            colors={{ datum: 'data.color' }}
            borderWidth={1}
            borderColor={{
              from: 'color',
              modifiers: [['darker', 0.2]]
            }}
            arcLinkLabelsSkipAngle={10}
            arcLinkLabelsTextColor="#333333"
            arcLinkLabelsThickness={2}
            arcLinkLabelsColor={{ from: 'color' }}
            arcLabel={d => `${d.data.percentage}%`}
            arcLabelsSkipAngle={10}
            arcLabelsTextColor={{
              from: 'color',
              modifiers: [['darker', 2]]
            }}
            tooltip={({ datum }) => (
              <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg min-w-56">
                <div className="space-y-2">
                  <p className="font-semibold text-gray-900">{datum.label}</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Sessions</p>
                      <p className="font-medium text-gray-900">{datum.value}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Percentage</p>
                      <p className="font-medium text-gray-900">{datum.data.percentage}%</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          />
        </div>
        {showLegend && (
          <div className="mt-4 space-y-2">
            {chartData.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm">{entry.label}: {entry.value} ({entry.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * TransferReasonsPareto - Visualizes transfer reasons using Pareto principle
 * 
 * @component
 * @param {SessionWithFacts[]} sessions - Array of analyzed sessions
 * @returns {JSX.Element} Horizontal bar chart with cumulative impact analysis
 * 
 * Features:
 * - Bars ordered by frequency (highest at top)
 * - Shows top 10 transfer reasons
 * - Tooltips display individual and cumulative percentages
 * - Grid lines aligned with tick marks for clarity
 * 
 * The Pareto principle helps identify the vital few reasons causing most transfers,
 * enabling targeted improvements to bot performance.
 */
export function TransferReasonsPareto({ sessions }: ChartProps) {
  const transferSessions = sessions.filter(s => 
    s.facts.sessionOutcome === 'Transfer' && s.facts.transferReason.trim()
  );

  if (transferSessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfer Reasons</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-gray-500">No transfer reasons found</p>
        </CardContent>
      </Card>
    );
  }

  const reasonCounts = transferSessions.reduce((acc, session) => {
    const reason = session.facts.transferReason;
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Sort by frequency (Pareto analysis) - highest frequency first
  const sortedReasons = Object.entries(reasonCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_PARETO_ITEMS);

  // Calculate cumulative impact percentages
  let cumulativeCount = 0;
  const chartData = sortedReasons.map(([reason, count]) => {
    cumulativeCount += count;
    const cumulativePercentage = ((cumulativeCount / transferSessions.length) * 100).toFixed(1);
    return {
      id: truncateText(reason),
      reason: truncateText(reason),
      fullReason: reason,
      count,
      cumulative: cumulativePercentage
    };
  })
  // Reverse for horizontal bar chart display (highest bars at top)
  .reverse();


  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Reasons</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveBar
            data={chartData}
            keys={['count']}
            indexBy="reason"
            layout="horizontal"
            margin={{ top: 20, right: 60, left: 150, bottom: 20 }}
            padding={0.3}
            colors={[COLORS.primary]}
            borderColor={{
              from: 'color',
              modifiers: [['darker', 1.6]]
            }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'Count',
              legendPosition: 'middle',
              legendOffset: 32,
              tickValues: [0, 1, 2, 3, 4]
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: '',
              legendPosition: 'middle',
              legendOffset: -40
            }}
            enableLabel={false}
            enableGridX={true}
            gridXValues={[0, 1, 2, 3, 4]}
            enableGridY={false}
            tooltip={({ id, value, data }) => (
              <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-md w-80">
                <div className="space-y-3">
                  {/* Transfer reason name - prominent header */}
                  <div className="border-b border-gray-100 pb-2">
                    <h4 className="font-semibold text-gray-900 text-sm leading-relaxed">
                      {data.fullReason}
                    </h4>
                  </div>
                  
                  {/* Statistics grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Sessions</p>
                      <p className="font-medium text-gray-900">{value}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500 text-xs uppercase tracking-wide">Individual %</p>
                      <p className="font-medium text-gray-900">
                        {((value / transferSessions.length) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  
                  {/* Cumulative impact - highlighted */}
                  <div className="bg-blue-50 rounded-md p-3 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700 font-medium text-sm">Cumulative Impact</span>
                      <span className="text-blue-800 font-bold text-lg">{data.cumulative}%</span>
                    </div>
                    <p className="text-blue-600 text-xs mt-1 leading-relaxed">
                      {data.cumulative}% of all transfers caused by this reason and those ranked above it
                    </p>
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * DropOffLocationsBar - Visualizes where users abandon conversations
 * 
 * @component
 * @param {SessionWithFacts[]} sessions - Array of analyzed sessions
 * @returns {JSX.Element} Horizontal bar chart showing drop-off points
 * 
 * Features:
 * - Shows top 8 drop-off locations
 * - Orange color scheme to highlight areas of concern
 * - Horizontal layout for better label readability
 * - Interactive tooltips with full location names
 */
export function DropOffLocationsBar({ sessions }: ChartProps) {
  const dropOffSessions = sessions.filter(s => s.facts.dropOffLocation.trim());

  if (dropOffSessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Drop-off Locations</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-gray-500">No drop-off locations found</p>
        </CardContent>
      </Card>
    );
  }

  const locationCounts = dropOffSessions.reduce((acc, session) => {
    const location = session.facts.dropOffLocation;
    acc[location] = (acc[location] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(locationCounts)
    .sort(([, a], [, b]) => b - a) // Sort descending by count
    .slice(0, MAX_BAR_ITEMS)
    .map(([location, count]) => ({
      id: truncateText(location),
      location: truncateText(location),
      fullLocation: location,
      count
    }))
    .reverse(); // Reverse for display (highest at top)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Drop-off Locations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveBar
            data={chartData}
            keys={['count']}
            indexBy="location"
            layout="horizontal"
            margin={{ top: 20, right: 50, left: 150, bottom: 20 }}
            padding={0.3}
            colors={[COLORS.warning]}
            borderColor={{
              from: 'color',
              modifiers: [['darker', 1.6]]
            }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'Count',
              legendPosition: 'middle',
              legendOffset: 32,
              tickValues: [0, 1, 2]
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: '',
              legendPosition: 'middle',
              legendOffset: -40
            }}
            enableLabel={false}
            enableGridX={true}
            gridXValues={[0, 1, 2]}
            enableGridY={false}
            tooltip={({ id, value, data }) => (
              <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-md w-80">
                <div className="space-y-3">
                  {/* Drop-off location name - prominent header */}
                  <div className="border-b border-gray-100 pb-2">
                    <h4 className="font-semibold text-gray-900 text-sm leading-relaxed">
                      {data.fullLocation}
                    </h4>
                  </div>
                  
                  {/* Session count */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</span>
                    <span className="font-bold text-gray-900">{value}</span>
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * GeneralIntentsBar - Visualizes the distribution of user intents
 * 
 * @component
 * @param {SessionWithFacts[]} sessions - Array of analyzed sessions
 * @returns {JSX.Element} Horizontal bar chart showing user intent categories
 * 
 * Features:
 * - Shows top 8 most common intents
 * - Indigo color scheme for neutral categorization
 * - Helps identify primary use cases and user needs
 * - Interactive tooltips with full intent descriptions
 */
export function GeneralIntentsBar({ sessions }: ChartProps) {
  const intentCounts = sessions.reduce((acc, session) => {
    const intent = session.facts.generalIntent;
    acc[intent] = (acc[intent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(intentCounts)
    .sort(([, a], [, b]) => b - a) // Sort descending by count
    .slice(0, MAX_BAR_ITEMS)
    .map(([intent, count]) => ({
      id: truncateText(intent),
      intent: truncateText(intent),
      fullIntent: intent,
      count
    }))
    .reverse(); // Reverse for display (highest at top)

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Intents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveBar
            data={chartData}
            keys={['count']}
            indexBy="intent"
            layout="horizontal"
            margin={{ top: 20, right: 50, left: 150, bottom: 20 }}
            padding={0.3}
            colors={[COLORS.info]}
            borderColor={{
              from: 'color',
              modifiers: [['darker', 1.6]]
            }}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: 'Count',
              legendPosition: 'middle',
              legendOffset: 32,
              tickValues: [0, 1, 2, 3, 4, 5, 6, 7]
            }}
            axisLeft={{
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: '',
              legendPosition: 'middle',
              legendOffset: -40
            }}
            enableLabel={false}
            enableGridX={true}
            gridXValues={[0, 1, 2, 3, 4, 5, 6, 7]}
            enableGridY={false}
            tooltip={({ id, value, data }) => (
              <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg max-w-md w-80">
                <div className="space-y-3">
                  {/* General intent name - prominent header */}
                  <div className="border-b border-gray-100 pb-2">
                    <h4 className="font-semibold text-gray-900 text-sm leading-relaxed">
                      {data.fullIntent}
                    </h4>
                  </div>
                  
                  {/* Session count */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</span>
                    <span className="font-bold text-gray-900">{value}</span>
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * AnalysisCostCard - Displays cost metrics and token usage for AI analysis
 * 
 * @component
 * @param {SessionWithFacts[]} sessions - Array of analyzed sessions
 * @returns {JSX.Element} Card displaying cost breakdown and usage statistics
 * 
 * Features:
 * - Total sessions analyzed count
 * - Token usage statistics (total and average per session)
 * - Cost estimation based on GPT-4o-mini pricing
 * - Model information display
 * - Cost per session calculation
 * 
 * Pricing is based on OpenAI's GPT-4o-mini model: $0.00015 per 1K tokens
 */
export function AnalysisCostCard({ sessions }: ChartProps) {
  const totalTokens = sessions.reduce((sum, session) => sum + session.analysisMetadata.tokensUsed, 0);
  const avgTokensPerSession = sessions.length > 0 ? Math.round(totalTokens / sessions.length) : 0;
  
  // GPT-4o-mini pricing: $0.00015 per 1K tokens
  const estimatedCost = (totalTokens / 1000) * 0.00015;
  
  // Get model from first session (assuming all sessions use same model)
  const model = sessions.length > 0 ? sessions[0].analysisMetadata.model || 'GPT-4o-mini' : 'GPT-4o-mini';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analysis Cost & Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{sessions.length}</div>
            <div className="text-sm text-gray-500">Total Sessions Analyzed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{totalTokens.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Total Tokens Used</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{model}</div>
            <div className="text-sm text-gray-500">Model Used</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">${estimatedCost.toFixed(4)}</div>
            <div className="text-sm text-gray-500">Estimated Cost</div>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Average tokens per session:</span> {avgTokensPerSession.toLocaleString()}
            </div>
            <div>
              <span className="font-medium">Cost per session:</span> ${sessions.length > 0 ? (estimatedCost / sessions.length).toFixed(4) : '0.0000'}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            * Cost estimate based on GPT-4o-mini pricing ($0.00015 per 1K tokens). Actual costs may vary.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}