/**
 * Shared containment badge component
 */

import { Badge } from './ui/badge';

interface ContainmentBadgeProps {
  type: string;
}

export const ContainmentBadge = ({ type }: ContainmentBadgeProps) => {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    'selfService': 'default',
    'agent': 'destructive',
    'dropOff': 'secondary'
  };
  
  const labels: Record<string, string> = {
    'selfService': 'Self Service',
    'agent': 'Agent',
    'dropOff': 'Drop Off'
  };
  
  return (
    <Badge variant={variants[type] || 'secondary'}>
      {labels[type] || type}
    </Badge>
  );
};