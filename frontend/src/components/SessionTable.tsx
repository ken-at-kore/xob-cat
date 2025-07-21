'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionWithTranscript } from '@/shared/types';

interface SessionTableProps {
  sessions: SessionWithTranscript[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

type SortField = 'session_id' | 'start_time' | 'duration_seconds' | 'containment_type';
type SortDirection = 'asc' | 'desc';

export function SessionTable({ sessions, loading = false, error = null, onRefresh }: SessionTableProps) {
  const [sortField, setSortField] = useState<SortField>('start_time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    sessionId: '',
    containmentType: ''
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedSessions = useMemo(() => {
    let filtered = sessions.filter(session => {
      // Filter by session ID
      if (filters.sessionId && !session.session_id.toLowerCase().includes(filters.sessionId.toLowerCase())) {
        return false;
      }
      
      // Filter by containment type
      if (filters.containmentType && session.containment_type !== filters.containmentType) {
        return false;
      }
      
      // Filter by date range
      if (filters.startDate || filters.endDate) {
        const sessionDate = new Date(session.start_time);
        const startDate = filters.startDate ? new Date(filters.startDate) : null;
        const endDate = filters.endDate ? new Date(filters.endDate) : null;
        
        if (startDate && sessionDate < startDate) return false;
        if (endDate && sessionDate > endDate) return false;
      }
      
      return true;
    });

    // Sort sessions
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'session_id':
          aValue = a.session_id;
          bValue = b.session_id;
          break;
        case 'start_time':
          aValue = new Date(a.start_time);
          bValue = new Date(b.start_time);
          break;
        case 'duration_seconds':
          aValue = a.duration_seconds || 0;
          bValue = b.duration_seconds || 0;
          break;
        case 'containment_type':
          aValue = a.containment_type;
          bValue = b.containment_type;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [sessions, filters, sortField, sortDirection]);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
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

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      onClick={() => handleSort(field)}
      className="h-auto p-0 font-medium hover:bg-transparent"
    >
      {children}
      {sortField === field && (
        <span className="ml-1">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </Button>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Overview</CardTitle>
          <CardDescription>Loading sessions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading sessions...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Overview</CardTitle>
          <CardDescription>Error loading sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            {onRefresh && (
              <Button onClick={onRefresh}>
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter UI */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter sessions by date, time, and other criteria (Eastern Time)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sessionId">Session ID</Label>
              <Input
                id="sessionId"
                placeholder="Search session ID..."
                value={filters.sessionId}
                onChange={(e) => setFilters(prev => ({ ...prev, sessionId: e.target.value }))}
              />
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="containmentType">Containment Type</Label>
              <select
                id="containmentType"
                value={filters.containmentType}
                onChange={(e) => setFilters(prev => ({ ...prev, containmentType: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">All Types</option>
                <option value="selfService">Self Service</option>
                <option value="agent">Agent</option>
                <option value="dropOff">Drop Off</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Session Overview</CardTitle>
          <CardDescription>
            {filteredAndSortedSessions.length} sessions found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortButton field="session_id">Session ID</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="start_time">Start Time</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="duration_seconds">Duration</SortButton>
                </TableHead>
                <TableHead>
                  <SortButton field="containment_type">Containment Type</SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedSessions.map((session) => (
                <TableRow key={session.session_id}>
                  <TableCell
                    className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] font-mono text-sm"
                    data-slot="table-cell"
                    data-testid="session-id"
                  >
                    {session.session_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{formatDateTime(session.start_time)}</TableCell>
                  <TableCell>{formatDuration(session.duration_seconds)}</TableCell>
                  <TableCell>
                    {getContainmentBadge(session.containment_type)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredAndSortedSessions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No sessions found matching your filters.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 