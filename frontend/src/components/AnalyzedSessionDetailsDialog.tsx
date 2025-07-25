'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDuration, formatDateTime, formatTime } from '@/lib/dateUtils';
import { ContainmentBadge } from './ContainmentBadge';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { SessionWithFacts } from '@/shared/types';

interface AnalyzedSessionDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionWithFacts[];
  currentSessionIndex: number;
  onNavigate: (index: number) => void;
}

export function AnalyzedSessionDetailsDialog({
  isOpen,
  onClose,
  sessions,
  currentSessionIndex,
  onNavigate
}: AnalyzedSessionDetailsDialogProps) {
  const currentSession = sessions[currentSessionIndex];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      switch (event.key) {
        case 'ArrowLeft':
          if (currentSessionIndex > 0) {
            event.preventDefault();
            onNavigate(currentSessionIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (currentSessionIndex < sessions.length - 1) {
            event.preventDefault();
            onNavigate(currentSessionIndex + 1);
          }
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSessionIndex, sessions.length, onClose, onNavigate]);

  if (!isOpen || !currentSession) {
    return null;
  }

  const isFirstSession = currentSessionIndex === 0;
  const isLastSession = currentSessionIndex === sessions.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col" showCloseButton={false}>
        <DialogHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle>Analyzed Session Details</DialogTitle>
              <DialogDescription>
                Detailed view of session {currentSession.session_id} with AI-extracted facts
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2 shrink-0"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              disabled={isFirstSession}
              onClick={() => onNavigate(currentSessionIndex - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-4">
              Session {currentSessionIndex + 1} of {sessions.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={isLastSession}
              onClick={() => onNavigate(currentSessionIndex + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* AI-Extracted Facts Section */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-blue-900">AI-Extracted Facts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="font-medium text-blue-800">General Intent</span>
                <div className="mt-1">
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                    {currentSession.facts.generalIntent}
                  </Badge>
                </div>
              </div>
              
              <div>
                <span className="font-medium text-blue-800">Session Outcome</span>
                <div className="mt-1">
                  <Badge 
                    variant={currentSession.facts.sessionOutcome === 'Transfer' ? 'destructive' : 'default'}
                    className={currentSession.facts.sessionOutcome === 'Transfer' ? '' : 'bg-green-100 text-green-800 border-green-300'}
                  >
                    {currentSession.facts.sessionOutcome}
                  </Badge>
                </div>
              </div>
              
              {currentSession.facts.transferReason && (
                <div>
                  <span className="font-medium text-blue-800">Transfer Reason</span>
                  <div className="mt-1 text-sm text-blue-700">
                    {currentSession.facts.transferReason}
                  </div>
                </div>
              )}
              
              {currentSession.facts.dropOffLocation && (
                <div>
                  <span className="font-medium text-blue-800">Drop-off Location</span>
                  <div className="mt-1 text-sm text-blue-700">
                    {currentSession.facts.dropOffLocation}
                  </div>
                </div>
              )}
              
              <div className="md:col-span-2">
                <span className="font-medium text-blue-800">AI Summary</span>
                <div className="mt-1 text-sm text-blue-700">
                  {currentSession.facts.notes}
                </div>
              </div>
            </div>
            
            {/* Analysis Metadata */}
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="flex flex-wrap gap-4 text-xs text-blue-600">
                <span>Tokens Used: {currentSession.analysisMetadata.tokensUsed}</span>
                <span>Processing Time: {currentSession.analysisMetadata.processingTime}ms</span>
                <span>Batch: #{currentSession.analysisMetadata.batchNumber}</span>
                <span>Analyzed: {formatDateTime(currentSession.analysisMetadata.timestamp)}</span>
              </div>
            </div>
          </div>

          {/* Session Information */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Session Information</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Session ID</span>
              </div>
              <div className="font-mono">{currentSession.session_id}</div>
              
              <div>
                <span className="font-medium text-muted-foreground">Containment Type</span>
              </div>
              <div><ContainmentBadge type={currentSession.containment_type} /></div>
              
              <div>
                <span className="font-medium text-muted-foreground">Start Time</span>
              </div>
              <div>{formatDateTime(currentSession.start_time)}</div>
              
              <div>
                <span className="font-medium text-muted-foreground">End Time</span>
              </div>
              <div>{formatDateTime(currentSession.end_time)}</div>
              
              <div>
                <span className="font-medium text-muted-foreground">Duration</span>
              </div>
              <div>{formatDuration(
                typeof currentSession.duration_seconds === 'number' && currentSession.duration_seconds >= 0
                  ? currentSession.duration_seconds
                  : (currentSession.start_time && currentSession.end_time
                      ? (new Date(currentSession.end_time).getTime() - new Date(currentSession.start_time).getTime()) / 1000
                      : null)
              )}</div>
              
              <div>
                <span className="font-medium text-muted-foreground">User ID</span>
              </div>
              <div className="font-mono">{currentSession.user_id}</div>
              
              <div>
                <span className="font-medium text-muted-foreground">Message Count</span>
              </div>
              <div>{currentSession.message_count} messages ({currentSession.user_message_count} user, {currentSession.bot_message_count} bot)</div>
            </div>
          </div>

          {/* Conversation */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Conversation Transcript</h3>
            <div className="border rounded-lg h-96 overflow-y-auto">
              {(() => {
                // Filter out invalid messages - must have required fields
                const validMessages = (currentSession.messages || []).filter(message => 
                  message && 
                  typeof message === 'object' &&
                  message.timestamp && 
                  message.message_type && 
                  (message.message_type === 'user' || message.message_type === 'bot') &&
                  message.message &&
                  typeof message.message === 'string' &&
                  message.message.trim().length > 0
                );

                return validMessages.length > 0 ? (
                  <div className="p-4 space-y-4">
                    {validMessages.map((message, index) => (
                      <div key={index} className="flex gap-3">
                        <div className="flex-shrink-0">
                          <Badge variant={message.message_type === 'user' ? 'outline' : 'secondary'}>
                            {message.message_type === 'user' ? 'User' : 'Bot'}
                          </Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground mb-1">
                            {formatTime(message.timestamp)}
                          </div>
                          <div className="text-sm break-words">
                            {message.message}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No messages in this session.</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}