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
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

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
  const [showHelp, setShowHelp] = useState(false);
  const [selectedBotVersion, setSelectedBotVersion] = useState<'XO11' | 'XO10'>('XO11');
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
      // Store credentials temporarily for the test ONLY
      sessionStorage.setItem('botCredentials', JSON.stringify(credentials));
      
      // Test the connection by calling the Kore.ai test endpoint with credentials
      const response = await apiClient.testKoreConnection();
      
      if (response.bot_name) {
        // Connection successful - credentials are already stored from the test
        // Navigate to dashboard
        if (onNavigate) {
          onNavigate(ROUTES.DASHBOARD_SESSIONS);
        } else {
          window.location.href = ROUTES.DASHBOARD_SESSIONS;
        }
      } else {
        // Clear stored credentials on unexpected response
        sessionStorage.removeItem('botCredentials');
        setConnectionError('Connection failed - invalid response from server');
      }
    } catch (error) {
      // IMPORTANT: Clear stored credentials on connection failure
      sessionStorage.removeItem('botCredentials');
      
      if (error instanceof ApiError) {
        // Handle specific authentication errors
        if (error.status === 401) {
          setConnectionError('Invalid credentials. Please check your Bot ID, Client ID, and Client Secret.');
        } else if (error.status === 0 && error.statusText === 'Network Error') {
          setConnectionError('Network error - unable to reach server. Please check your internet connection.');
        } else if (error.status === 0 && error.statusText === 'Unknown Error') {
          setConnectionError('Connection timeout - the server is not responding. Please try again.');
        } else {
          setConnectionError(`Connection failed (${error.status}): ${error.message}`);
        }
        
        // Log detailed error for debugging
        console.error('Connection test failed:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          data: error.data
        });
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed - unable to reach server';
        setConnectionError(errorMessage);
        
        // Log unexpected errors
        console.error('Unexpected connection error:', error);
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
            src="/assets/Kore.ai_Emblem_Grey.svg" 
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
          {/* Help Section */}
          <div className={`rounded-lg transition-all ${showHelp ? 'border p-4 bg-muted/30' : ''}`}>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center justify-between w-full text-left hover:opacity-80 transition-opacity py-1"
              type="button"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">How to get these credentials?</span>
              </div>
              {showHelp ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            
            {showHelp && (
              <div className="mt-4 space-y-4">
                {/* Bot Version Tabs */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedBotVersion('XO11')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedBotVersion === 'XO11' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    type="button"
                  >
                    XO11 Bots
                  </button>
                  <button
                    onClick={() => setSelectedBotVersion('XO10')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedBotVersion === 'XO10' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                    type="button"
                  >
                    XO10 Bots
                  </button>
                </div>
                
                {/* Instructions */}
                <div className="bg-background rounded-md p-4 space-y-2 text-sm">
                  {selectedBotVersion === 'XO11' ? (
                    <ol className="list-decimal list-inside space-y-2">
                      <li>In your XO bot, go to <span className="font-mono bg-muted px-1 rounded">App Settings → Dev Tools → API Scopes</span></li>
                      <li>Edit one of the JWT apps</li>
                      <li>Copy the <strong>App ID</strong>, <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                      <li>Enable <strong>"App Sessions"</strong> and <strong>"Chat History"</strong></li>
                      <li>Hit <strong>Save</strong></li>
                    </ol>
                  ) : (
                    <ol className="list-decimal list-inside space-y-2">
                      <li>In your XO bot, go to <span className="font-mono bg-muted px-1 rounded">Deploy → APIs & Extensions → API Scopes</span></li>
                      <li>Edit one of the JWT apps</li>
                      <li>Copy the <strong>Bot ID</strong>, <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                      <li>Enable <strong>"Bot Sessions"</strong> and <strong>"Chat History"</strong></li>
                      <li>Hit <strong>Save</strong></li>
                    </ol>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Hidden decoy fields to confuse password managers */}
          <div style={{ display: 'none' }}>
            <input type="text" name="fakeusername" autoComplete="username" />
            <input type="password" name="fakepassword" autoComplete="current-password" />
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="botId">Bot ID / App ID</Label>
              <Input
                id="botId"
                ref={botIdRef}
                type="text"
                autoComplete="off"
                placeholder="Enter your Bot ID or App ID"
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
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md" data-testid="credential-error">
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
