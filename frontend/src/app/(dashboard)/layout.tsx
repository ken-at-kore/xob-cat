'use client';

import { useState, useEffect } from 'react';
import { redirectTo } from "@/lib/utils";
import TopNav from "@/components/TopNav";
import Sidebar from "@/components/Sidebar";

interface BotCredentials {
  botId: string;
  clientId: string;
  clientSecret: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [credentials, setCredentials] = useState<BotCredentials | null>(null);

  useEffect(() => {
    // Check if user is authenticated with retry logic for race conditions
    const checkCredentials = () => {
      try {
        const storedCredentials = sessionStorage.getItem('botCredentials');
        if (!storedCredentials) {
          console.warn('No credentials found in sessionStorage');
          return false;
        }

        const parsedCredentials = JSON.parse(storedCredentials);
        console.log('Successfully loaded credentials from sessionStorage');
        setCredentials(parsedCredentials);
        return true;
      } catch (error) {
        console.error('Failed to parse stored credentials:', error);
        return false;
      }
    };

    // Try immediately first
    if (checkCredentials()) {
      return;
    }

    // If failed, wait 100ms and try again (handles race conditions)
    console.log('Retrying credential check after 100ms...');
    const retryTimeout = setTimeout(() => {
      if (!checkCredentials()) {
        console.log('Credential check failed after retry, redirecting to login');
        redirectTo('/');
      }
    }, 100);

    return () => clearTimeout(retryTimeout);
  }, []);

  if (!credentials) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Setting up your dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav botId={credentials.botId} />
      <Sidebar />
      
      {/* Main Content */}
      <main className="ml-64 pt-16" data-testid="main-content">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
} 