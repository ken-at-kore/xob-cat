'use client';

import { useState, useMemo, useEffect } from 'react';
import { formatDuration, formatDateTime } from '@/lib/dateUtils';
import { ContainmentBadge } from './ContainmentBadge';
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
  filters: {
    startDate: string;
    endDate: string;
    startTime: string;
    endTime: string;
  };
  setFilters: (filters: { startDate: string; endDate: string; startTime: string; endTime: string }) => void;
  onApplyFilters: () => void;
  onRowClick?: (session: SessionWithTranscript, index: number) => void;
}

type SortField = 'session_id' | 'start_time' | 'duration_seconds' | 'containment_type';
type SortDirection = 'asc' | 'desc';

export function SessionTable({ sessions, loading = false, error = null, onRefresh, filters, setFilters, onApplyFilters, onRowClick }: SessionTableProps) {
  const [sortField, setSortField] = useState<SortField>('start_time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [userSorted, setUserSorted] = useState(false);

  // If filters change and user hasn't sorted, sort by start_time asc
  useEffect(() => {
    if (!userSorted && (filters.startDate || filters.endDate || filters.startTime || filters.endTime)) {
      setSortField('start_time');
      setSortDirection('asc');
    }
  }, [filters, userSorted]);

  const handleSort = (field: SortField) => {
    setUserSorted(true);
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedSessions = useMemo(() => {
    const sorted = [...sessions];
    sorted.sort((a, b) => {
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
          aValue = typeof a.duration_seconds === 'number' && a.duration_seconds > 0
            ? a.duration_seconds
            : (a.start_time && a.end_time ? (new Date(a.end_time).getTime() - new Date(a.start_time).getTime()) / 1000 : 0);
          bValue = typeof b.duration_seconds === 'number' && b.duration_seconds > 0
            ? b.duration_seconds
            : (b.start_time && b.end_time ? (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 1000 : 0);
          break;
        case 'containment_type':
          aValue = a.containment_type;
          bValue = b.containment_type;
          break;
        default:
          aValue = a[sortField];
          bValue = b[sortField];
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [sessions, sortField, sortDirection]);


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
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Session Overview</h2>
          <p className="text-gray-600">Loading sessions...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading sessions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Session Overview</h2>
          <p className="text-gray-600">Error loading sessions</p>
        </div>
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error}</p>
          {onRefresh && (
            <Button onClick={onRefresh} className="bg-blue-600 hover:bg-blue-700 text-white">
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter UI */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Filters</h3>
          <p className="text-sm text-gray-600">
            Filter sessions by date, time, and other criteria (Eastern Time)
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={filters.startTime}
                onChange={(e) => setFilters({ ...filters, startTime: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={filters.endTime}
                onChange={(e) => setFilters({ ...filters, endTime: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={onApplyFilters}>
                Filter
              </Button>
            </div>
          </div>
        </div>

      {/* Sessions Table */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold mb-1">Session Overview</h2>
          <p className="text-gray-600">
            {sortedSessions.length} sessions found
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">
                  <SortButton field="session_id">Session ID</SortButton>
                </TableHead>
                <TableHead className="text-left">
                  <SortButton field="start_time">Start Time</SortButton>
                </TableHead>
                <TableHead className="text-left">
                  <SortButton field="duration_seconds">Duration</SortButton>
                </TableHead>
                <TableHead className="text-left">
                  <SortButton field="containment_type">Containment Type</SortButton>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSessions.map((session, sortedIndex) => {
                // Find the original index in the unsorted sessions array
                const originalIndex = sessions.findIndex(s => s.session_id === session.session_id);
                return (
                  <TableRow 
                    key={session.session_id}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                    onClick={() => onRowClick?.(session, originalIndex)}
                  >
                    <TableCell
                    className="p-2 align-middle whitespace-nowrap font-mono text-sm text-left"
                    data-slot="table-cell"
                    data-testid="session-id"
                  >
                    {session.session_id}
                  </TableCell>
                  <TableCell className="text-left">{formatDateTime(session.start_time)}</TableCell>
                  <TableCell className="text-left">{
                    formatDuration(
                      typeof session.duration_seconds === 'number' && session.duration_seconds > 0
                        ? session.duration_seconds
                        : (session.start_time && session.end_time
                            ? (new Date(session.end_time).getTime() - new Date(session.start_time).getTime()) / 1000
                            : null)
                    )
                  }</TableCell>
                  <TableCell className="text-left">
                    <ContainmentBadge type={session.containment_type} />
                  </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          
          {sortedSessions.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600">No sessions found matching your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 