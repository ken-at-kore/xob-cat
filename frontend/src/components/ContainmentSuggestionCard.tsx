import React from 'react';
import { Card, CardContent } from './ui/card';
import { TrendingUp } from 'lucide-react';

interface ContainmentSuggestionCardProps {
  suggestion: string;
}

export function ContainmentSuggestionCard({ suggestion }: ContainmentSuggestionCardProps) {
  return (
    <Card>
      <CardContent className="pl-6 pr-8 py-6 flex items-center">
        <div className="flex items-start space-x-4 w-full">
          <div className="flex-shrink-0">
            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              Containment Improvement
            </h3>
            <p className="text-base leading-relaxed text-gray-700 font-medium">
              {suggestion}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}