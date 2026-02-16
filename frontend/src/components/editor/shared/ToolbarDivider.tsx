/**
 * ToolbarDivider Component
 * Visual separator for toolbar button groups.
 * Extracted from AdvancedEditor for shared use.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface ToolbarDividerProps {
  className?: string;
}

export function ToolbarDivider({ className }: ToolbarDividerProps) {
  return <div className={cn('w-px h-6 bg-gray-300 mx-2', className)} />;
}
