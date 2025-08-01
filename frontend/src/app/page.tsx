'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, ApiError } from '@/lib/api';
import { ROUTES } from '@/routes';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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
    botId: '',
    clientId: '',
    clientSecret: ''
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const botIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (botIdRef.current) {
      botIdRef.current.focus();
    }
  }, []);

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
      // Store credentials temporarily for the test
      sessionStorage.setItem('botCredentials', JSON.stringify(credentials));
      
      // Test the connection by calling the Kore.ai test endpoint with credentials
      const response = await apiClient.testKoreConnection();
      
      if (response.bot_name) {
        // Connection successful, redirect to dashboard
        if (onNavigate) {
          onNavigate(ROUTES.DASHBOARD_SESSIONS);
        } else {
          window.location.href = ROUTES.DASHBOARD_SESSIONS;
        }
      } else {
        setConnectionError('Connection failed - invalid response');
      }
    } catch (error) {
      // Clear stored credentials on connection failure
      sessionStorage.removeItem('botCredentials');
      
      if (error instanceof ApiError) {
        setConnectionError(`${error.message} (${error.status})`);
      } else {
        setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      }
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
    <ErrorBoundary>
      <div className="min-h-screen flex items-start justify-center bg-background p-4 pt-16">
        <div className="flex flex-col items-center space-y-6 w-full max-w-md">
          <Image 
            src="/kore-emblem-grey.svg" 
            alt="Kore.ai" 
            width={80}
            height={80}
            className="w-20 h-20"
          />
          <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to XOBCAT</CardTitle>
          <CardDescription>
            XO Bot Conversation Analysis Tools - Empowering Kore.ai platform users 
            to investigate and analyze IVA and chatbot session data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hidden decoy fields to confuse password managers */}
          <div style={{ display: 'none' }}>
            <input type="text" name="fakeusername" autoComplete="username" />
            <input type="password" name="fakepassword" autoComplete="current-password" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botId">Bot ID</Label>
              <Input
                id="botId"
                ref={botIdRef}
                type="text"
                autoComplete="off"
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
                autoComplete="off"
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
                type="text"
                autoComplete="off"
                autoSave="off"
                data-lpignore="true"
                data-form-type="config"
                data-1p-ignore="true"
                name="api-token"
                role="textbox"
                aria-label="API Token Configuration Field"
                placeholder="Enter your Client Secret"
                value={credentials.clientSecret}
                onChange={(e) => handleInputChange('clientSecret', e.target.value)}
                className={`${errors.clientSecret ? 'border-destructive' : ''} [text-security:disc] [-webkit-text-security:disc] [-moz-text-security:disc]`}
                style={{
                  // @ts-ignore - CSS security properties not in React types
                  textSecurity: 'disc',
                  WebkitTextSecurity: 'disc',
                  MozTextSecurity: 'disc',
                  fontFamily: 'text-security-disc, -apple-system, BlinkMacSystemFont, sans-serif'
                } as React.CSSProperties}
              />
              {errors.clientSecret && (
                <p className="text-sm text-destructive">{errors.clientSecret}</p>
              )}
            </div>
          </div>
          
          {connectionError && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{connectionError}</p>
            </div>
          )}
          
          <Button 
            onClick={handleConnect} 
            disabled={isConnecting}
            className="w-full mt-6"
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        </CardContent>
      </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}
