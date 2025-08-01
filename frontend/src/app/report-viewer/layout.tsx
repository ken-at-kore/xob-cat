import { ReactNode } from 'react';

export const metadata = {
  title: 'XOBCAT Report Viewer',
  description: 'View exported XOBCAT analysis reports',
};

interface ReportViewerLayoutProps {
  children: ReactNode;
}

export default function ReportViewerLayout({ children }: ReportViewerLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple header for report viewer */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img 
                src="/assets/Kore.ai_Emblem_Grey.svg" 
                alt="Kore.ai" 
                className="h-8 w-8 mr-3"
              />
              <h1 className="text-xl font-semibold" style={{ color: '#667085' }}>XOBCAT Report Viewer</h1>
              <span className="ml-3 text-sm text-gray-500">View and analyze exported reports</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content area */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}