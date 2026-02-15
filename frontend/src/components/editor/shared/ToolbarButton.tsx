/**
 * ToolbarButton Component
 * Reusable toolbar button for Tiptap editor toolbars.
 * Extracted from AdvancedEditor for shared use.
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface ToolbarButtonProps {
  icon: React.ElementType;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  className?: string;
}

export function ToolbarButton({
  icon: Icon,
  onClick,
  isActive,
  disabled,
  title,
  className,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-2 rounded transition-colors',
        isActive
          ? 'bg-primary-100 text-primary-700'
          : 'hover:bg-gray-100 text-gray-600',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      title={title}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
