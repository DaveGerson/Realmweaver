
import React from 'react';
import { Icons } from '../common/Icons';

interface ContentWrapperProps {
    title: string;
    children: React.ReactNode;
    icon?: keyof typeof Icons;
}

export const ContentWrapper: React.FC<ContentWrapperProps> = ({ title, children, icon }) => {
    const Icon = icon ? Icons[icon] : null;
    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto custom-scrollbar space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 text-indigo-400">
                {Icon && <Icon className="w-8 h-8" />}
                <h1 className="text-3xl font-bold font-serif text-slate-100">{title}</h1>
            </div>
            {children}
        </div>
    );
};
