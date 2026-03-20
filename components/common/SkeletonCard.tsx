
import React from 'react';

interface SkeletonCardProps {
    count?: number;
    compact?: boolean;
}

const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`bg-slate-700/50 rounded animate-pulse ${className}`} />
);

export const SkeletonCard: React.FC<{ compact?: boolean }> = ({ compact }) => (
    <div className={`bg-slate-900/50 p-4 rounded-lg border border-slate-800 space-y-3 ${compact ? 'h-20' : ''}`}>
        <SkeletonPulse className="h-5 w-2/3" />
        <SkeletonPulse className="h-3 w-full" />
        <SkeletonPulse className="h-3 w-4/5" />
        {!compact && <SkeletonPulse className="h-3 w-1/3" />}
    </div>
);

export const SkeletonCardGrid: React.FC<SkeletonCardProps> = ({ count = 4, compact }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonCard key={i} compact={compact} />
        ))}
    </div>
);

export const SkeletonGeneratorOverlay: React.FC = () => (
    <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl z-10">
        <div className="space-y-3 w-3/4">
            <SkeletonPulse className="h-6 w-1/2 mx-auto" />
            <SkeletonPulse className="h-4 w-full" />
            <SkeletonPulse className="h-4 w-5/6" />
            <SkeletonPulse className="h-4 w-3/4" />
            <SkeletonPulse className="h-3 w-1/3 mx-auto mt-4" />
        </div>
        <p className="mt-4 text-sm text-slate-400 animate-pulse">Weaving into existence...</p>
    </div>
);
