import React, { useState, useEffect } from 'react';
import { Share, Download, Copy, ExternalLink, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from './ui/dialog';

interface ShareReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisId?: string;
}

export function ShareReportModal({ isOpen, onClose, analysisId }: ShareReportModalProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [downloadCompleted, setDownloadCompleted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setDownloadCompleted(false);
      setIsDownloading(false);
      setCopySuccess(false);
    }
  }, [isOpen]);

  // Get report viewer URL from environment with fallback
  const reportViewerUrl = process.env.NEXT_PUBLIC_REPORT_VIEWER_URL || 'https://www.koreai-xobcat.com/report-viewer';

  const handleDownload = async () => {
    if (!analysisId) {
      console.error('No analysis ID provided for download');
      return;
    }

    setIsDownloading(true);
    
    try {
      // Get credentials from sessionStorage for API call
      const credentials = sessionStorage.getItem('botCredentials');
      const credentialHeaders: Record<string, string> = {};
      
      if (credentials) {
        try {
          const parsed = JSON.parse(credentials);
          credentialHeaders['x-bot-id'] = parsed.botId;
          credentialHeaders['x-client-id'] = parsed.clientId;
          credentialHeaders['x-client-secret'] = parsed.clientSecret;
        } catch (error) {
          console.warn('Failed to parse stored credentials:', error);
        }
      }

      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/analysis/auto-analyze/parallel/export/${analysisId}`, {
        headers: {
          'x-jwt-token': localStorage.getItem('jwt-token') || 'default-token',
          ...credentialHeaders
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to download analysis');
      }
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'xob-cat-analysis.json';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setDownloadCompleted(true);
    } catch (error) {
      console.error('Failed to download analysis:', error);
      alert('Failed to download analysis report. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(reportViewerUrl);
      setCopySuccess(true);
      
      // Hide success message after 2 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      alert('Failed to copy link to clipboard. Please copy manually.');
    }
  };

  const handleOpenReportViewer = () => {
    window.open(reportViewerUrl, '_blank');
  };

  const handleNextStep = () => {
    setCurrentStep(2);
  };

  const handleBackStep = () => {
    setCurrentStep(1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="h-5 w-5" />
            Share Analysis Report
          </DialogTitle>
          <DialogDescription>
            Step {currentStep} of 2
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {currentStep === 1 ? (
            // Step 1: Download Report
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Download Report Data</h3>
                <p className="text-gray-600 text-sm mb-4">
                  First, download the analysis report data file. This contains all the session analysis results 
                  and can be uploaded to the report viewer for sharing with stakeholders.
                </p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <Download className="h-5 w-5 text-gray-500" />
                </div>
                <div className="flex-grow">
                  <p className="text-sm font-medium">Analysis Report Data</p>
                  <p className="text-xs text-gray-500">JSON file containing session analysis results</p>
                </div>
                <Button 
                  onClick={handleDownload} 
                  disabled={isDownloading}
                  className="flex items-center gap-2"
                >
                  {isDownloading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download Report Data
                    </>
                  )}
                </Button>
              </div>

              {downloadCompleted && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Report downloaded successfully! You can now proceed to share the viewer link.
                </div>
              )}
            </div>
          ) : (
            // Step 2: Share Report Viewer Link
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">Share Report Viewer Link</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Share this link with stakeholders so they can upload and view the analysis report. 
                  They will be able to explore all charts, filters, and session details.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700">Report Viewer URL</label>
                <div className="flex gap-2">
                  <Input 
                    value={reportViewerUrl}
                    readOnly
                    className="flex-grow font-mono text-sm"
                  />
                  <Button 
                    onClick={handleCopyLink}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    {copySuccess ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {copySuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Link Copied!
                </div>
              )}

              <div className="pt-2">
                <Button 
                  onClick={handleOpenReportViewer}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Report Viewer
                  <span className="text-xs text-gray-500">(Opens in new tab)</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {currentStep === 1 ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleNextStep}
              >
                Next: Share Link
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleBackStep}>
                Back
              </Button>
              <Button onClick={onClose}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}