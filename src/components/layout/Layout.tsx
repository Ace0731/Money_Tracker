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
            { name: 'Projects', path: '/projects', icon: '📋' },
            { name: 'Breakdown', path: '/income-breakdown', icon: '⏱️' },
            { name: 'Estimator', path: '/estimator', icon: '🧠' },
        ]
    },
    {
        title: 'System',
        items: [
            { name: 'Settings', path: '/settings', icon: '⚙️' },
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
                <div className="p-4 border-b border-slate-700/50">
                    <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent tracking-tight">
                        Money Tracker
                    </h1>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium uppercase tracking-tighter">Personal Wealth Dashboard</p>
                </div>

                <nav className="flex-1 p-3 flex flex-col justify-between overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {navigationGroups.map((group) => (
                        <div key={group.title}>
                            <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                                {group.title}
                            </h3>
                            <div className="space-y-0.5">
                                {group.items.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.path}
                                            className={`flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all ${isActive
                                                ? 'bg-blue-600/15 text-blue-400 border border-blue-500/20 shadow-sm'
                                                : 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-100'
                                                }`}
                                        >
                                            <span className="text-xl leading-none">{item.icon}</span>
                                            <span className="font-bold text-sm tracking-wide">{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-2 border-t border-slate-700/50">
                    <div className="text-[10px] text-slate-600 text-center">
                        v2.1.0 • Local Only
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
