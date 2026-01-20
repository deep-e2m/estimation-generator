import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary-100 text-primary-700 hover:bg-primary-200',
        secondary:
          'border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200',
        destructive:
          'border-transparent bg-error-100 text-error-700 hover:bg-error-200',
        outline: 'text-gray-700 border border-gray-300',
        success:
          'border-transparent bg-success-100 text-success-700',
        warning:
          'border-transparent bg-warning-100 text-warning-700',
        info: 'border-transparent bg-primary-100 text-primary-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
