"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"
import { cn } from "../../lib/utils"

/**
 * Progress bar component with optional animation support.
 * 
 * Features:
 * - Blue color (#2970FF) for improved visual contrast
 * - Optional pulse animation (`animated` prop) with shimmer overlay
 * - Prevents invisible bars by showing minimum 5% when animated
 * - Used in auto-analyze progress tracking to indicate activity during pauses
 * 
 * Test page available at: /test-progress
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    animated?: boolean;
  }
>(({ className, value, animated = false, ...props }, ref) => {
  // When animated and value is very low, show at least 5% so shimmer is visible
  const displayValue = animated && (value || 0) < 5 ? 5 : (value || 0);
  
  return (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 transition-all"
      style={{ 
        transform: `translateX(-${100 - displayValue}%)`,
        backgroundColor: '#2970FF',
        animation: animated ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
      }}
    />
    {animated && (
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent" style={{
        animation: 'shimmer 2s ease-in-out infinite'
      }} />
    )}
  </ProgressPrimitive.Root>
  );
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }