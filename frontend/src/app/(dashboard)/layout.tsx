'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { redirectTo } from "@/lib/utils";
import { ROUTES } from '@/routes';

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
  const pathname = usePathname();

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

  const handleDisconnect = () => {
    sessionStorage.removeItem('botCredentials');
    redirectTo('/');
  };

  const isActive = (path: string) => {
    return pathname === path;
  };

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
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">XOB CAT</h1>
            <div className="text-sm text-muted-foreground">
              Connected Bot ID: <span className="font-mono">{credentials.botId}</span>
            </div>
          </div>
          <Button variant="ghost" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <aside className="w-64 border-r bg-card min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-2">
            <Link href={ROUTES.DASHBOARD_SESSIONS}>
              <Card className={`p-3 cursor-pointer transition-colors ${
                isActive(ROUTES.DASHBOARD_SESSIONS) 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              }`}>
                <div className="font-medium">View Sessions</div>
              </Card>
            </Link>
            <Link href="/dashboard/analyze">
              <Card className={`p-3 cursor-pointer transition-colors ${
                isActive('/dashboard/analyze') 
                  ? 'bg-primary text-primary-foreground' 
                  : 'hover:bg-muted'
              }`}>
                <div className="font-medium">Analyze Sessions</div>
              </Card>
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
} 