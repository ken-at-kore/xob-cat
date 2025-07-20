'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from '@/lib/api';
import { SessionWithTranscript } from '@/shared/types';
import Link from 'next/link';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionWithTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getSessions();
      if (response.success && response.data) {
        setSessions(response.data);
      } else {
        setError('Failed to load sessions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getContainmentBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      'selfService': 'default',
      'agent': 'destructive',
      'dropOff': 'secondary'
    };
    
    return (
      <Badge variant={variants[type] || 'secondary'}>
        {type}
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
                <TableHead>Session ID</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Containment</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.session_id}>
                  <TableCell className="font-mono text-sm">
                    {session.session_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>{session.user_id}</TableCell>
                  <TableCell>{formatDate(session.start_time)}</TableCell>
                  <TableCell>{formatDuration(session.duration_seconds)}</TableCell>
                  <TableCell>
                    {session.message_count} ({session.user_message_count} user, {session.bot_message_count} bot)
                  </TableCell>
                  <TableCell>
                    {getContainmentBadge(session.containment_type)}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm">
                      <Link href={`/sessions/${session.session_id}`}>
                        View Details
                      </Link>
                    </Button>
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