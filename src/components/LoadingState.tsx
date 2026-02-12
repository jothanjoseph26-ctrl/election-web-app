import React, { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className={cn('animate-spin', sizeClasses[size])} />
      {text && <span className="text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}

interface LoadingStateProps {
  loading: boolean;
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ 
  loading, 
  children, 
  fallback, 
  className, 
  text = 'Loading...', 
  size = 'md' 
}: LoadingStateProps) {
  if (loading) {
    return fallback || (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <LoadingSpinner size={size} text={text} />
      </div>
    );
  }

  return <>{children}</>;
}

interface PageLoadingProps {
  text?: string;
  className?: string;
}

export function PageLoading({ text = 'Loading...', className }: PageLoadingProps) {
  return (
    <div className={cn('min-h-screen flex items-center justify-center', className)}>
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-lg text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
}

export function Skeleton({ className, children, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Common skeleton components
export function CardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-6 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="p-4 space-y-2">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-8 w-1/3" />
    </div>
  );
}

export function ListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center space-x-3 p-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}