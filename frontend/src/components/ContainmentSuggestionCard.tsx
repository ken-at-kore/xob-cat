import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Card, CardContent } from './ui/card';
import { Lightbulb } from 'lucide-react';

interface ContainmentSuggestionCardProps {
  suggestion: string;
}

export function ContainmentSuggestionCard({ suggestion }: ContainmentSuggestionCardProps) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-start space-x-4 w-full">
          <div className="flex-shrink-0">
            <div className="p-5 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg">
              <Lightbulb className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 leading-tight">
              Containment Improvement
            </h3>
            <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-strong:text-gray-900 prose-strong:font-semibold prose-ul:text-gray-700 prose-li:text-gray-700 prose-em:text-gray-600 prose-em:font-medium text-base leading-6 text-gray-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {suggestion}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}