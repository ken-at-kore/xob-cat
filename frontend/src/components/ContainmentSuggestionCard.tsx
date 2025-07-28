import React from 'react';
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
            <p className="text-base leading-6 text-gray-700">
              {suggestion}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}