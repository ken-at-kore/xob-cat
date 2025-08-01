'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { AnalysisFileValidator } from '../../../../shared/services/analysisFileValidator';
import { AnalysisExportFile } from '../../../../shared/types';

export default function ReportViewerPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFileChooserOpenRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string>('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isFileChooserOpen, setIsFileChooserOpen] = useState(false);

  const handleFileSelect = async (file: File) => {
    setError('');
    setWarnings([]);
    setIsValidating(true);

    try {
      // Validate file size
      const sizeValidation = AnalysisFileValidator.validateFileSize(file.size);
      if (!sizeValidation.isValid) {
        setError(sizeValidation.errors[0]);
        setIsValidating(false);
        return;
      }

      // Read and parse file
      const text = await file.text();
      const parseResult = AnalysisFileValidator.parseJsonFile(text);
      
      if (parseResult.error) {
        setError(parseResult.error);
        setIsValidating(false);
        return;
      }

      // Validate file structure and version
      const validation = AnalysisFileValidator.validateFile(parseResult.data);
      
      if (!validation.isValid) {
        setError(validation.errors.join('; '));
        setIsValidating(false);
        return;
      }

      // Show any warnings
      if (validation.warnings.length > 0) {
        setWarnings(validation.warnings);
      }

      // Store the file data in sessionStorage and navigate to view page
      const exportFile = parseResult.data as AnalysisExportFile;
      sessionStorage.setItem('reportViewerData', JSON.stringify(exportFile));
      router.push('/report-viewer/view');

    } catch (err) {
      console.error('Failed to process file:', err);
      setError('Failed to process the file. Please ensure it is a valid XOBCAT analysis export.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const jsonFile = files.find(f => f.name.endsWith('.json'));

    if (!jsonFile) {
      setError('Please upload a JSON file');
      return;
    }

    handleFileSelect(jsonFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset the file chooser state when a file is selected or dialog is dismissed
    isFileChooserOpenRef.current = false;
    setIsFileChooserOpen(false);
  };

  const handleChooseFile = () => {
    // Prevent multiple file chooser dialogs from opening using ref for immediate check
    if (isFileChooserOpenRef.current || isValidating) {
      return;
    }
    
    // Set both ref (immediate) and state (for UI)
    isFileChooserOpenRef.current = true;
    setIsFileChooserOpen(true);
    
    // Trigger the file input click
    fileInputRef.current?.click();
    
    // Reset the flag after a delay in case the dialog was cancelled
    setTimeout(() => {
      isFileChooserOpenRef.current = false;
      setIsFileChooserOpen(false);
    }, 2000);
  };

  const handleNavigateToApp = () => {
    window.location.href = '/';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Upload Analysis Report</CardTitle>
          <CardDescription>
            Upload an XOBCAT analysis export file to view the report
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Drag and drop area */}
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 bg-gray-50 hover:border-gray-400'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-600">
              Drag and drop your analysis file here, or
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={handleChooseFile}
              disabled={isValidating || isFileChooserOpen}
            >
              {isFileChooserOpen ? 'Opening File Chooser...' : 'Choose File'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <p className="mt-2 text-xs text-gray-500">
              Only JSON files exported from XOBCAT are supported
            </p>
          </div>

          {/* Loading state */}
          {isValidating && (
            <Alert className="mt-4">
              <AlertDescription>
                Validating file...
              </AlertDescription>
            </Alert>
          )}

          {/* Error display */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Warnings display */}
          {warnings.length > 0 && (
            <Alert className="mt-4">
              <AlertDescription>
                <strong>Warnings:</strong>
                <ul className="list-disc list-inside mt-1">
                  {warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Link to main app */}
          <div className="mt-6 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Want to create your own analysis?{' '}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={handleNavigateToApp}
              >
                Go to XOBCAT
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}