'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnalysisReportView } from '../../../components/AnalysisReportView';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { AnalysisExportFile, AnalysisResults } from '../../../../../shared/types';

export default function ReportViewerViewPage() {
  const router = useRouter();
  const [reportData, setReportData] = useState<AnalysisExportFile | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Load data from sessionStorage
    const storedData = sessionStorage.getItem('reportViewerData');
    
    if (!storedData) {
      setError('No report data found. Please upload a report file.');
      return;
    }

    try {
      const data = JSON.parse(storedData) as AnalysisExportFile;
      setReportData(data);
    } catch (err) {
      console.error('Failed to parse report data:', err);
      setError('Failed to load report data. The file may be corrupted.');
    }
  }, []);

  const handleStartNewAnalysis = () => {
    // Navigate to the main app's home page (credentials)
    window.location.href = '/';
  };

  const handleUploadNew = () => {
    // Clear stored data and go back to upload page
    sessionStorage.removeItem('reportViewerData');
    router.push('/report-viewer');
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 text-center">
          <Button onClick={handleUploadNew}>
            Upload Report
          </Button>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center">
        <p className="text-gray-600">Loading report...</p>
      </div>
    );
  }

  // Convert export data to AnalysisResults format expected by AnalysisReportView
  const analysisResults: AnalysisResults = {
    sessions: reportData.sessions,
    analysisSummary: reportData.summary ? {
      overview: reportData.summary.overview,
      summary: reportData.summary.detailedAnalysis,
      containmentSuggestion: (reportData.summary as any).containmentImprovementText || '', // Use containmentImprovementText if available
      generatedAt: reportData.metadata.exportedAt,
      sessionsAnalyzed: reportData.sessions.length,
      statistics: {
        totalSessions: reportData.summary.totalSessions,
        transferRate: 1 - reportData.summary.containmentRate,
        containmentRate: reportData.summary.containmentRate,
        averageSessionLength: 0, // Not included in export
        averageMessagesPerSession: 0 // Not included in export
      }
    } : undefined
  };

  return (
    <div className="space-y-4">
      {/* Report metadata header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-gray-900">Analysis Report</h2>
            <p className="text-sm text-gray-500">
              Exported on {new Date(reportData.metadata.exportedAt).toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">
              Analysis period: {reportData.analysisConfig.startDate} {reportData.analysisConfig.startTime} ET
              {' • '}
              {reportData.analysisConfig.sessionCount} sessions analyzed
            </p>
          </div>
          <Button onClick={handleUploadNew} variant="outline" size="sm">
            Upload New Report
          </Button>
        </div>
      </div>

      {/* Main report view */}
      <AnalysisReportView 
        results={analysisResults} 
        onStartNew={handleStartNewAnalysis}
      />
    </div>
  );
}