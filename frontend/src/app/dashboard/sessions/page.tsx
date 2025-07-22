"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SessionWithTranscript } from '@/shared/types';
import { apiClient, ApiError } from '@/lib/api';
import { SessionTable } from '@/components/SessionTable';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SessionDetailsDialog } from '@/components/SessionDetailsDialog';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionWithTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: ''
  });

  // Dialog state for session details
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);

  useEffect(() => {
    loadSessions();
  }, []);

  const hasActiveFilters = (f: typeof filters) => {
    return f.startDate || f.endDate || f.startTime || f.endTime;
  };

  const loadSessions = async (filterOverride?: typeof filters) => {
    try {
      setLoading(true);
      setError(null);
      const f = filterOverride || filters;
      // Compose API filters
      const apiFilters: any = {};
      if (f.startDate) apiFilters.start_date = f.startDate;
      if (f.endDate) apiFilters.end_date = f.endDate;
      if (f.startTime) apiFilters.start_time = f.startTime;
      if (f.endTime) apiFilters.end_time = f.endTime;
      
      // Dynamic limit: 1000 when filtering, 50 for initial load
      apiFilters.limit = hasActiveFilters(f) ? 1000 : 50;
      
      const sessions = await apiClient.getSessions(apiFilters);
      setSessions(sessions.slice(0, apiFilters.limit));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.message} (${err.status})`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load sessions');
      }
    } finally {
      setLoading(false);
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

  if (loading || error) {
    // Let SessionTable handle loading and error UI
    return (
      <SessionTable
        sessions={sessions}
        loading={loading}
        error={error}
        onRefresh={() => loadSessions()}
        filters={filters}
        setFilters={setFilters}
        onApplyFilters={onApplyFilters}
        onRowClick={handleRowClick}
      />
    );
  }

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