import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const navigationGroups = [
    {
        title: 'Overview',
        items: [
            { name: 'Dashboard', path: '/dashboard', icon: '📊' },
            { name: 'Reports', path: '/reports', icon: '📈' },
        ]
    },
    {
        title: 'Finance',
        items: [
            { name: 'Transactions', path: '/transactions', icon: '💳' },
            { name: 'Accounts', path: '/accounts', icon: '🏦' },
            { name: 'Categories', path: '/categories', icon: '📁' },
        ]
    },
    {
        title: 'Business',
        items: [
            { name: 'Clients', path: '/clients', icon: '👥' },
            { name: 'Projects', path: '/projects', icon: '📋' },
        ]
    },
    {
        title: 'Growth',
        items: [
            { name: 'Investments', path: '/investments', icon: '💰' },
        ]
    }
];

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-slate-900">
            {/* Sidebar */}
            <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col">
                <div className="p-6 border-b border-slate-700">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                        Money Tracker
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">Track every rupee</p>
                </div>

                <nav className="flex-1 p-4 overflow-y-auto space-y-6">
                    {navigationGroups.map((group) => (
                        <div key={group.title}>
                            <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                                {group.title}
                            </h3>
                            <div className="space-y-1">
                                {group.items.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.path}
                                            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${isActive
                                                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                                                : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                                                }`}
                                        >
                                            <span className="text-lg">{item.icon}</span>
                                            <span className="font-medium text-sm">{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-slate-700">
                    <div className="text-xs text-slate-500 text-center">
                        v1.8.0 • Local Only
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-auto bg-slate-900">
                {children}
            </div>
        </div>
    );
}
