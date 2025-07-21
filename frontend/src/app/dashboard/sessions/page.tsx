"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { SessionWithTranscript } from '@/shared/types';
import { apiClient } from '@/lib/api';

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

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Calculate date range for the last hour
      const now = Date.now();
      const endDate = new Date(now);
      const startDate = new Date(now - 1 * 60 * 60 * 1000); // 1 hour ago
      // Use the API client to get at most 50 sessions from the last hour
      const response = await apiClient.getSessions({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        limit: 50
      });
      
      if (response.success && response.data) {
        // Filter sessions to only those from the last hour
        const now = Date.now();
        const oneHourAgo = now - 1 * 60 * 60 * 1000;
        const filtered = response.data.filter(session => {
          const start = new Date(session.start_time).getTime();
          return start >= oneHourAgo && start <= now;
        });
        // Sort by start_time descending (most recent first)
        filtered.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
        // Limit to 50
        setSessions(filtered.slice(0, 50));
      } else {
        throw new Error(response.message || 'Failed to load sessions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-destructive">Error: {error}</p>
          <Button onClick={loadSessions} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground">
            Browse and analyze chatbot session data
          </p>
        </div>
        <Button onClick={loadSessions}>
          Refresh
        </Button>
      </div>

      {/* Filter UI */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter sessions by date and time range (Eastern Time)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={filters.startTime}
                onChange={(e) => setFilters(prev => ({ ...prev, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={filters.endTime}
                onChange={(e) => setFilters(prev => ({ ...prev, endTime: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Session Overview</CardTitle>
          <CardDescription>
            {sessions.length} sessions found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <th scope="col">Session ID</th>
                <th scope="col">Start Time</th>
                <th scope="col">Duration</th>
                <th scope="col">Containment Type</th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.slice(0, 50).map((session) => (
                <TableRow key={session.session_id}>
                  <TableCell className="font-mono text-sm" data-testid="session-id">
                    {session.session_id}
                  </TableCell>
                  <TableCell>{formatDateTime(session.start_time)}</TableCell>
                  <TableCell>{
                    formatDuration(
                      typeof session.duration_seconds === 'number' && session.duration_seconds > 0
                        ? session.duration_seconds
                        : (session.start_time && session.end_time
                            ? (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 1000
                            : null)
                    )
                  }</TableCell>
                  <TableCell>
                    {getContainmentBadge(session.containment_type)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
} 