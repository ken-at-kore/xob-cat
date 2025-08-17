"use client";

import { useState, useEffect } from 'react';
import { useResetOnBFCache } from '@/hooks/useResetOnBFCache';

import { SessionWithTranscript } from '@/shared/types';
import { apiClient, ApiError } from '@/lib/api';
import { SessionTable } from '@/components/SessionTable';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SessionDetailsDialog } from '@/components/SessionDetailsDialog';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionWithTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: ''
  });

  // Reset filters on bfcache restore (essential fix for back/forward navigation)
  const resetFilters = () => {
    setFilters({ startDate: '', endDate: '', startTime: '', endTime: '' });
  };
  useResetOnBFCache(resetFilters);



  // Dialog state for session details
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);

  // Request cancellation support
  const [currentRequest, setCurrentRequest] = useState<AbortController | null>(null);

  // Log bfcache events for debugging
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      console.info('📄 pageshow event', { persisted: (e as any).persisted });
    };
    window.addEventListener('pageshow', handlePageShow as any);
    return () => window.removeEventListener('pageshow', handlePageShow as any);
  }, []);

  useEffect(() => {
    loadSessions();
  }, []);

  // Cleanup effect to cancel ongoing requests when component unmounts
  useEffect(() => {
    return () => {
      if (currentRequest) {
        currentRequest.abort();
      }
    };
  }, [currentRequest]);

  /**
   * Checks if any filter criteria are currently active
   */
  const hasActiveFilters = (f: typeof filters) => {
    return !!(f.startDate || f.endDate || f.startTime || f.endTime);
  };

  /**
   * Builds API query parameters from filter state, dropping empty values
   */
  const buildQuery = (f: typeof filters) => {
    const params = new URLSearchParams();
    if (f.startDate) params.set('start_date', f.startDate);
    if (f.endDate) params.set('end_date', f.endDate);
    if (f.startTime) params.set('start_time', f.startTime);
    if (f.endTime) params.set('end_time', f.endTime);
    
    // Set limit based on whether we have active filters
    const limit = hasActiveFilters(f) ? 1000 : 50;
    params.set('limit', limit.toString());
    
    return params.toString();
  };

  /**
   * Loads sessions from the API with request cancellation support.
   * Cancels any previous in-flight requests before making a new one.
   * Supports filter application to interrupt ongoing loads.
   */
  const loadSessions = async (filterOverride?: typeof filters) => {
    // Cancel any existing request
    if (currentRequest) {
      currentRequest.abort();
    }

    // Create new AbortController for this request
    const abortController = new AbortController();
    setCurrentRequest(abortController);

    try {
      setLoading(true);
      setError(null);
      const f = filterOverride || filters;
      
      // Build query using only state values, dropping empty strings
      const queryString = buildQuery(f);
      
      // Use URLSearchParams to create clean filter object for API client
      const params = new URLSearchParams(queryString);
      const apiFilters: Record<string, string | number> = {};
      params.forEach((value, key) => {
        // Convert limit to number for proper typing
        apiFilters[key] = key === 'limit' ? parseInt(value, 10) : value;
      });
      
      const sessions = await apiClient.getSessions(apiFilters);
      
      // Only update state if request wasn't cancelled
      if (!abortController.signal.aborted) {
        setSessions(sessions.slice(0, apiFilters.limit as number));
        setHasLoadedOnce(true);
        setCurrentRequest(null);
      }
    } catch (err) {
      // Don't update error state if request was cancelled
      if (abortController.signal.aborted) {
        return;
      }

      if (err instanceof ApiError) {
        setError(`${err.message} (${err.status})`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      }
      setHasLoadedOnce(true);
      setCurrentRequest(null);
    } finally {
      // Only update loading state if request wasn't cancelled
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const onApplyFilters = () => {
    loadSessions(filters);
  };

  const handleRowClick = (session: SessionWithTranscript, index: number) => {
    setSelectedSessionIndex(index);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
  };

  const handleSessionNavigate = (index: number) => {
    setSelectedSessionIndex(index);
  };

  const formatDuration = (seconds?: number | string | null) => {
    const value = Number(seconds);
    // Fixed: Check for null/undefined specifically, but allow 0 
    if (seconds === null || seconds === undefined || isNaN(value) || value < 0) return 'N/A';
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const remainingSeconds = Math.floor(value % 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/New_York'
    }) + ' ET';
  };

  const getContainmentBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      'selfService': 'default',
      'agent': 'destructive',
      'dropOff': 'secondary'
    };
    
    const labels: Record<string, string> = {
      'selfService': 'Self Service',
      'agent': 'Agent',
      'dropOff': 'Drop Off'
    };
    
    return (
      <Badge variant={variants[type] || 'secondary'}>
        {labels[type] || type}
      </Badge>
    );
  };

  // Always render the complete page structure

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">
            Browse and analyze chatbot session data
          </p>
        </div>
        <SessionTable
          sessions={sessions}
          loading={loading}
          error={error}
          hasLoadedOnce={hasLoadedOnce}
          onRefresh={() => loadSessions()}
          filters={filters}
          setFilters={setFilters}
          onApplyFilters={onApplyFilters}
          onRowClick={handleRowClick}
        />
        
        {/* Session Details Dialog */}
        <SessionDetailsDialog
          isOpen={isDialogOpen}
          onClose={handleDialogClose}
          sessions={sessions}
          currentSessionIndex={selectedSessionIndex}
          onNavigate={handleSessionNavigate}
        />
      </div>
    </ErrorBoundary>
  );
}