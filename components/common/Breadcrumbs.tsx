
import React from 'react';
import { Icons } from './Icons';

export interface BreadcrumbSegment {
    label: string;
    onClick?: () => void;
}

interface BreadcrumbsProps {
    segments: BreadcrumbSegment[];
    canGoBack?: boolean;
    onGoBack?: () => void;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ segments, canGoBack = false, onGoBack }) => {
    if (segments.length <= 1 && !canGoBack) return null;

    return (
        <nav className="flex items-center gap-1.5 text-sm text-slate-500 px-6 md:px-8 pt-4 pb-2" aria-label="Breadcrumb">
            {canGoBack && (
                <button
                    onClick={onGoBack}
                    aria-label="Go back"
                    title="Go back"
                    className="flex items-center justify-center w-6 h-6 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0 mr-1"
                >
                    <Icons.ArrowLeft className="w-3.5 h-3.5" />
                </button>
            )}
            {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;
                return (
                    <React.Fragment key={index}>
                        {index > 0 && (
                            <Icons.ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                        )}
                        {isLast ? (
                            <span className="text-slate-300 font-medium truncate max-w-[200px]" title={segment.label}>
                                {segment.label}
                            </span>
                        ) : (
                            <button
                                onClick={segment.onClick}
                                className="hover:text-slate-300 transition-colors truncate max-w-[150px]"
                                title={segment.label}
                            >
                                {segment.label}
                            </button>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
};
