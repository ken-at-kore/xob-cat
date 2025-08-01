'use client';

import { useRouter } from 'next/navigation';

/**
 * TopNav component provides the main navigation header for the XOB CAT application.
 * 
 * Features:
 * - Fixed positioning at top of screen with proper z-index layering
 * - Left side: Kore logo + "XOBCAT" title with de-emphasized subtitle
 * - Right side: Bot ID label + value + bullet separator + disconnect button
 * - Handles disconnect navigation back to credentials page
 * 
 * Layout:
 * ┌─────────────────────────────────────────────────────────┐
 * │ [Logo] XOBCAT  XO Bot Conversation...  │  Bot ID xxx • Disconnect │
 * └─────────────────────────────────────────────────────────┘
 */

interface TopNavProps {
  /** The bot ID to display in the navigation bar */
  botId: string;
}

/**
 * Top navigation component for the XOBCAT dashboard
 */
export default function TopNav({ botId }: TopNavProps) {
  const router = useRouter();

  const handleDisconnect = () => {
    router.push('/');
  };

  return (
    <nav
      role="navigation"
      className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-3"
    >
      <div className="flex justify-between items-center">
        {/* Left side: Kore logo + app name + subtitle */}
        <div className="flex items-center space-x-3">
          <img 
            src="/assets/Kore.ai_Emblem_Grey.svg" 
            alt="Kore.ai" 
            className="h-8 w-8"
          />
          <h1 className="text-xl font-bold" style={{ color: '#667085' }}>XOBCAT</h1>
          <span className="text-sm text-gray-500">
            XO Bot Conversation Analysis Tools
          </span>
        </div>
        
        {/* Right side: Bot ID label + value + bullet + disconnect */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Bot ID</span>
            <span className="text-sm font-mono text-gray-700">
              {botId}
            </span>
          </div>
          <span className="text-gray-400">•</span>
          <button
            onClick={handleDisconnect}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Disconnect
          </button>
        </div>
      </div>
    </nav>
  );
}