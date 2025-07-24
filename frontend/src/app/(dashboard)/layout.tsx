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
    // Check if user is authenticated
    const storedCredentials = sessionStorage.getItem('botCredentials');
    if (!storedCredentials) {
      // Redirect to login if no credentials
      redirectTo('/');
      return;
    }

    try {
      const parsedCredentials = JSON.parse(storedCredentials);
      setCredentials(parsedCredentials);
    } catch (error) {
      console.error('Failed to parse stored credentials:', error);
      redirectTo('/');
    }
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