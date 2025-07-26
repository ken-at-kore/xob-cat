import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { SessionWithFacts } from '@/shared/types';

// Color palette for charts
const COLORS = {
  primary: '#3B82F6',    // Blue
  secondary: '#EF4444',  // Red
  success: '#10B981',    // Green
  warning: '#F59E0B',    // Amber
  info: '#6366F1',       // Indigo
  purple: '#8B5CF6',     // Purple
  orange: '#F97316',     // Orange
  teal: '#14B8A6',       // Teal
  pink: '#EC4899',       // Pink
  gray: '#6B7280'        // Gray
};

const PIE_COLORS = [COLORS.success, COLORS.secondary, COLORS.warning, COLORS.info, COLORS.purple];
const BAR_COLOR = COLORS.primary;

interface ChartProps {
  sessions: SessionWithFacts[];
}

/**
 * Session Outcomes Pie Chart
 * Shows distribution of Contained vs Transfer outcomes
 */
export function SessionOutcomePieChart({ sessions }: ChartProps) {
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

  const chartData = Object.entries(outcomeData).map(([outcome, count]) => ({
    name: outcome,
    value: count,
    percentage: ((count / sessions.length) * 100).toFixed(1)
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-gray-600">
            Count: {data.value} ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Outcomes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                dataKey="value"
                label={({ name, percentage }) => `${name}: ${percentage}%`}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-2">
          {chartData.map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                <span className="text-sm">{entry.name}: {entry.value} ({entry.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Transfer Reasons Pareto Chart
 * Shows transfer reasons ordered by frequency (Pareto principle)
 */
export function TransferReasonsPareto({ sessions }: ChartProps) {
  const transferSessions = sessions.filter(s => 
    s.facts.sessionOutcome === 'Transfer' && s.facts.transferReason.trim()
  );

  if (transferSessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transfer Reasons (Pareto Analysis)</CardTitle>
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

  // Sort by frequency (Pareto analysis)
  const sortedReasons = Object.entries(reasonCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Top 10 reasons

  let cumulativeCount = 0;
  const chartData = sortedReasons.map(([reason, count]) => {
    cumulativeCount += count;
    return {
      reason: reason.length > 20 ? reason.substring(0, 20) + '...' : reason,
      fullReason: reason,
      count,
      cumulative: ((cumulativeCount / transferSessions.length) * 100).toFixed(1)
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg max-w-xs">
          <p className="font-medium">{data.fullReason}</p>
          <p className="text-sm text-gray-600">Count: {data.count}</p>
          <p className="text-sm text-gray-600">Cumulative: {data.cumulative}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Reasons (Pareto Analysis)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="reason" 
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={BAR_COLOR} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-1">
          {chartData.slice(0, 5).map((item) => (
            <div key={item.fullReason} className="text-sm text-gray-600">
              {item.fullReason}: {item.count}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Drop-off Locations Bar Chart
 * Shows where users dropped off during conversations
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
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8) // Top 8 locations
    .map(([location, count]) => ({
      location: location.length > 15 ? location.substring(0, 15) + '...' : location,
      fullLocation: location,
      count
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{data.fullLocation}</p>
          <p className="text-sm text-gray-600">Count: {data.count}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Drop-off Locations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="location" 
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={COLORS.warning} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * General Intents Bar Chart
 * Shows distribution of user intents
 */
export function GeneralIntentsBar({ sessions }: ChartProps) {
  const intentCounts = sessions.reduce((acc, session) => {
    const intent = session.facts.generalIntent;
    acc[intent] = (acc[intent] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(intentCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8) // Top 8 intents
    .map(([intent, count]) => ({
      intent: intent.length > 15 ? intent.substring(0, 15) + '...' : intent,
      fullIntent: intent,
      count
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{data.fullIntent}</p>
          <p className="text-sm text-gray-600">Count: {data.count}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General Intents</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="intent" 
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill={COLORS.info} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-1">
          {chartData.slice(0, 5).map((item) => (
            <div key={item.fullIntent} className="text-sm text-gray-600">
              {item.fullIntent}: {item.count}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Analysis Cost Card
 * Shows cost breakdown and token usage
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