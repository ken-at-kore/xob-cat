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

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async (filterOverride?: typeof filters) => {
    try {
      setLoading(true);
      setError(null);
      const f = filterOverride || filters;
      // Compose API filters
      const apiFilters: any = {};
      if (f.startDate) apiFilters.start_date = f.startDate;
      if (f.endDate) apiFilters.end_date = f.endDate;
      // Optionally add time filters if backend supports
      // if (f.startTime) apiFilters.start_time = f.startTime;
      // if (f.endTime) apiFilters.end_time = f.endTime;
      apiFilters.limit = 50;
      const sessions = await apiClient.getSessions(apiFilters);
      setSessions(sessions.slice(0, 50));
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

  const formatDuration = (seconds?: number | string | null) => {
    const value = Number(seconds);
    if (!seconds || isNaN(value) || value <= 0) return 'N/A';
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
        />
      </div>
    </ErrorBoundary>
  );
} 