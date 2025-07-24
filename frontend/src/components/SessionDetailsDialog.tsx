'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDuration, formatDateTime, formatTime } from '@/lib/dateUtils';
import { ContainmentBadge } from './ContainmentBadge';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { SessionWithTranscript } from '@/shared/types';

interface SessionDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: SessionWithTranscript[];
  currentSessionIndex: number;
  onNavigate: (index: number) => void;
}

export function SessionDetailsDialog({
  isOpen,
  onClose,
  sessions,
  currentSessionIndex,
  onNavigate
}: SessionDetailsDialogProps) {
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
      <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col" showCloseButton={false}>
        <DialogHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle>Session Details</DialogTitle>
              <DialogDescription>
                Detailed view of session {currentSession.session_id}
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
            </div>
          </div>

          {/* Conversation */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Conversation</h3>
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