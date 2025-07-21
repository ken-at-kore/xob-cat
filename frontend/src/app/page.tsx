'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from '@/lib/api';
import { ROUTES } from '@/routes';

interface Credentials {
  botId: string;
  clientId: string;
  clientSecret: string;
}

interface ValidationErrors {
  botId?: string;
  clientId?: string;
  clientSecret?: string;
}

interface HomeProps {
  onNavigate?: (url: string) => void;
}

export default function Home({ onNavigate }: HomeProps = {}) {
  const [credentials, setCredentials] = useState<Credentials>({
    botId: '***REMOVED***',
    clientId: '***REMOVED***',
    clientSecret: '***REMOVED***'
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};
    
    if (!credentials.botId.trim()) {
      newErrors.botId = 'Bot ID is required';
    }
    if (!credentials.clientId.trim()) {
      newErrors.clientId = 'Client ID is required';
    }
    if (!credentials.clientSecret.trim()) {
      newErrors.clientSecret = 'Client Secret is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConnect = async () => {
    setConnectionError(null);
    
    if (!validateForm()) {
      return;
    }
    
    setIsConnecting(true);
    
    try {
      // Test the connection by calling the health check endpoint
      const response = await apiClient.healthCheck();
      
      if (response.status === 'ok') {
        // Store credentials in session storage for the dashboard
        sessionStorage.setItem('botCredentials', JSON.stringify(credentials));
        // Redirect to dashboard
        if (onNavigate) {
          onNavigate(ROUTES.DASHBOARD_SESSIONS);
        } else {
          window.location.href = ROUTES.DASHBOARD_SESSIONS;
        }
      } else {
        setConnectionError('Connection failed - invalid response');
      }
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleInputChange = (field: keyof Credentials, value: string) => {
    setCredentials(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to XOB CAT</CardTitle>
          <CardDescription>
            XO Bot Conversation Analysis Tools - Empowering Kore.ai Expert Services teams 
            to investigate and analyze chatbot and IVA session data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="botId">Bot ID</Label>
            <Input
              id="botId"
              type="text"
              placeholder="Enter your Bot ID"
              value={credentials.botId}
              onChange={(e) => handleInputChange('botId', e.target.value)}
              className={errors.botId ? 'border-destructive' : ''}
            />
            {errors.botId && (
              <p className="text-sm text-destructive">{errors.botId}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              type="text"
              placeholder="Enter your Client ID"
              value={credentials.clientId}
              onChange={(e) => handleInputChange('clientId', e.target.value)}
              className={errors.clientId ? 'border-destructive' : ''}
            />
            {errors.clientId && (
              <p className="text-sm text-destructive">{errors.clientId}</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              placeholder="Enter your Client Secret"
              value={credentials.clientSecret}
              onChange={(e) => handleInputChange('clientSecret', e.target.value)}
              className={errors.clientSecret ? 'border-destructive' : ''}
            />
            {errors.clientSecret && (
              <p className="text-sm text-destructive">{errors.clientSecret}</p>
            )}
          </div>
          
          {connectionError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{connectionError}</p>
            </div>
          )}
          
          <Button 
            onClick={handleConnect} 
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
