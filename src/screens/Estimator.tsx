import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Swal from 'sweetalert2';

interface EstimatorModule {
    id: number;
    name: String;
    avg_hours: number;
    usage_count: number;
}

interface EstimatorProject {
    id: number;
    name: string;
    project_type: string;
    base_hours: number;
    adjusted_hours: number;
    learning_factor: number;
    final_hours: number;
    hourly_rate: number;
    estimated_price: number;
    actual_hours?: number;
    actual_price?: number;
    ratio?: number;
    complexity: string;
    urgency: string;
    risk: string;
    is_completed: number;
    is_high_value: number;
    suggested_price_at_creation: number;
    created_at: string;
}

const PROJECT_TYPES = ['Web', 'Mobile', 'Fullstack', 'Design', 'Other'];

const MULTIPLIERS = {
    complexity: { Low: 1.0, Medium: 1.5, High: 2.0 },
    urgency: { Normal: 1.0, Urgent: 1.3 },
    risk: { Low: 1.0, Medium: 1.2, High: 1.4 }
};

export default function Estimator() {
    const [activeTab, setActiveTab] = useState<'estimate' | 'history' | 'modules' | 'system'>('estimate');
    const [modules, setModules] = useState<EstimatorModule[]>([]);
    const [history, setHistory] = useState<EstimatorProject[]>([]);
    const [settings, setSettings] = useState<Record<string, string>>({
        learning_factor: '0.8',
        default_hourly_rate: '300'
    });

    // Form State
    const [projectName, setProjectName] = useState('');
    const [projectType, setProjectType] = useState('Web');
    const [selectedModuleIds, setSelectedModuleIds] = useState<number[]>([]);
    const [complexity, setComplexity] = useState<keyof typeof MULTIPLIERS.complexity>('Medium');
    const [urgency, setUrgency] = useState<keyof typeof MULTIPLIERS.urgency>('Normal');
    const [risk, setRisk] = useState<keyof typeof MULTIPLIERS.risk>('Low');
    const [isHighValueManual, setIsHighValueManual] = useState(false);
    const [customHourlyRate, setCustomHourlyRate] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [m, h, s] = await Promise.all([
                invoke<EstimatorModule[]>('get_estimator_modules'),
                invoke<EstimatorProject[]>('get_estimator_projects'),
                invoke<Record<string, string>>('get_estimator_settings')
            ]);
            setModules(m);
            setHistory(h);
            setSettings(s);
        } catch (error) {
            console.error('Failed to fetch estimator data:', error);
        }
    };

    // Calculations
    const calculations = useMemo(() => {
        const baseHours = selectedModuleIds.reduce((sum, id) => {
            const m = modules.find(mod => mod.id === id);
            return sum + (m?.avg_hours || 0);
        }, 0);

        const learningFactor = parseFloat(settings.learning_factor) || 0.8;
        const hourlyRate = customHourlyRate || parseFloat(settings.default_hourly_rate) || 300;
        const threshold = parseFloat(settings.market_premium_threshold || '20000');

        const adjustedHours = baseHours 
            * MULTIPLIERS.complexity[complexity]
            * MULTIPLIERS.urgency[urgency]
            * MULTIPLIERS.risk[risk];

        const correctedHours = adjustedHours * learningFactor;
        const finalHours = correctedHours * 1.2; // 20% Buffer
        const basePrice = finalHours * hourlyRate;
        
        // Hybrid Segmentation
        const isHighValue = isHighValueManual || basePrice > threshold;
        const premium = isHighValue 
            ? (parseFloat(settings.market_premium_high_value) || 1.2)
            : (parseFloat(settings.market_premium) || 1.0);

        const price = basePrice * premium;

        return {
            baseHours,
            adjustedHours,
            correctedHours,
            finalHours,
            price,
            hourlyRate,
            learningFactor,
            isHighValue
        };
    }, [selectedModuleIds, modules, complexity, urgency, risk, settings, customHourlyRate, isHighValueManual]);

    const handleSaveEstimate = async () => {
        if (!projectName || selectedModuleIds.length === 0) {
            Swal.fire('Error', 'Please provide a project name and select at least one module.', 'error');
            return;
        }

        try {
            await invoke('create_estimator_project', {
                name: projectName,
                projectType,
                baseHours: calculations.baseHours,
                adjustedHours: calculations.adjustedHours,
                learningFactor: calculations.learningFactor,
                finalHours: calculations.finalHours,
                hourlyRate: calculations.hourlyRate,
                estimatedPrice: calculations.price,
                complexity,
                urgency,
                risk,
                isHighValue: calculations.isHighValue ? 1 : 0,
                suggestedPriceAtCreation: calculations.price,
                moduleIds: selectedModuleIds.join(',')
            });
            Swal.fire('Success', 'Estimate saved successfully!', 'success');
            setProjectName('');
            setSelectedModuleIds([]);
            fetchData();
            setActiveTab('history');
        } catch (error) {
            Swal.fire('Error', String(error), 'error');
        }
    };

    const handleLogActuals = async (project: EstimatorProject) => {
        const { value: formValues } = await Swal.fire({
            title: 'Project Outcome',
            html:
                `<div class="text-left space-y-4">` +
                `<label class="text-xs font-black text-slate-500 uppercase">Actual Hours Worked</label>` +
                `<input id="actual-hours" class="swal2-input !mt-1" type="number" step="0.1" value="${project.final_hours.toFixed(1)}">` +
                `<label class="text-xs font-black text-slate-500 uppercase mt-4 block">Final Amount Charged (₹)</label>` +
                `<input id="actual-price" class="swal2-input !mt-1" type="number" value="${project.suggested_price_at_creation || project.estimated_price}">` +
                `</div>`,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'FINALIZE & LEARN',
            preConfirm: () => {
                return [
                    (document.getElementById('actual-hours') as HTMLInputElement).value,
                    (document.getElementById('actual-price') as HTMLInputElement).value
                ]
            }
        });
 
        if (formValues) {
            try {
                await invoke('update_estimator_actuals', {
                    projectId: project.id,
                    actualHours: parseFloat(formValues[0]),
                    actualPrice: parseFloat(formValues[1]),
                    moduleIds: []
                });
                Swal.fire('Success', 'Learning factor updated and project closed!', 'success');
                fetchData();
            } catch (error) {
                Swal.fire('Error', String(error), 'error');
            }
        }
    };


    return (
        <div className="min-h-screen p-6 text-slate-100 bg-slate-900 font-sans selection:bg-blue-500/30">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                        Project Estimator
                    </h1>
                    <p className="text-slate-400 mt-1 font-medium italic">Feedback-driven estimation engine • v1.0</p>
                </div>
                
                <div className="flex bg-slate-800/50 p-1.5 rounded-2xl border border-slate-700/50 shadow-xl backdrop-blur-md">
                    <button 
                        onClick={() => setActiveTab('estimate')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'estimate' ? 'bg-blue-600 shadow-lg shadow-blue-600/20 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        NEW ESTIMATE
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'history' ? 'bg-blue-600 shadow-lg shadow-blue-600/20 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        HISTORY
                    </button>
                    <button 
                        onClick={() => setActiveTab('modules')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'modules' ? 'bg-blue-600 shadow-lg shadow-blue-600/20 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        MODULES
                    </button>
                    <button 
                        onClick={() => setActiveTab('system')}
                        className={`px-6 py-2 rounded-xl font-bold transition-all ${activeTab === 'system' ? 'bg-blue-600 shadow-lg shadow-blue-600/20 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        SYSTEM
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto">
                {activeTab === 'estimate' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Inputs Section */}
                        <div className="lg:col-span-2 space-y-6">
                            <section className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center text-blue-400 text-sm">01</span>
                                    Project Identity
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1">Project Name</label>
                                        <input 
                                            type="text" 
                                            value={projectName}
                                            onChange={(e) => setProjectName(e.target.value)}
                                            placeholder="e.g. E-commerce Mobile App"
                                            className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-5 py-4 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium text-lg"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1">Project Type</label>
                                        <div className="flex flex-wrap gap-2">
                                            {PROJECT_TYPES.map(type => (
                                                <button
                                                    key={type}
                                                    onClick={() => setProjectType(type)}
                                                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border ${projectType === type ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center text-indigo-400 text-sm">02</span>
                                    Module Selection
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2 scrollbar-none">
                                    {modules.map(module => (
                                        <div 
                                            key={module.id}
                                            onClick={() => {
                                                setSelectedModuleIds(prev => 
                                                    prev.includes(module.id) ? prev.filter(id => id !== module.id) : [...prev, module.id]
                                                );
                                            }}
                                            className={`p-4 rounded-2xl border transition-all cursor-pointer group ${selectedModuleIds.includes(module.id) 
                                                ? 'bg-blue-600/10 border-blue-500/50 shadow-inner' 
                                                : 'bg-slate-900/40 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/50'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className={`font-bold transition-colors ${selectedModuleIds.includes(module.id) ? 'text-blue-400' : 'text-slate-200'}`}>
                                                        {module.name}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 mt-1 font-medium">{module.usage_count} projects completed</p>
                                                </div>
                                                <span className={`text-sm font-black px-2 py-1 rounded-lg ${selectedModuleIds.includes(module.id) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                                    {module.avg_hours.toFixed(1)}h
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
                                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center text-purple-400 text-sm">03</span>
                                    Project Adjustments
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* Complexity */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Complexity</label>
                                        <div className="flex flex-col gap-2">
                                            {Object.keys(MULTIPLIERS.complexity).map(level => (
                                                <button
                                                    key={level}
                                                    onClick={() => setComplexity(level as any)}
                                                    className={`flex justify-between items-center px-4 py-3 rounded-xl font-bold text-sm transition-all border ${complexity === level ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-900/50 border-slate-700 text-slate-400'}`}
                                                >
                                                    {level}
                                                    <span className="opacity-50">×{MULTIPLIERS.complexity[level as keyof typeof MULTIPLIERS.complexity]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Urgency */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Urgency</label>
                                        <div className="flex flex-col gap-2">
                                            {Object.keys(MULTIPLIERS.urgency).map(level => (
                                                <button
                                                    key={level}
                                                    onClick={() => setUrgency(level as any)}
                                                    className={`flex justify-between items-center px-4 py-3 rounded-xl font-bold text-sm transition-all border ${urgency === level ? 'bg-amber-600/20 border-amber-500 text-amber-400' : 'bg-slate-900/50 border-slate-700 text-slate-400'}`}
                                                >
                                                    {level}
                                                    <span className="opacity-50">×{(MULTIPLIERS.urgency as any)[level]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Risk */}
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Risk</label>
                                        <div className="flex flex-col gap-2">
                                            {Object.keys(MULTIPLIERS.risk).map(level => (
                                                <button
                                                    key={level}
                                                    onClick={() => setRisk(level as any)}
                                                    className={`flex justify-between items-center px-4 py-3 rounded-xl font-bold text-sm transition-all border ${risk === level ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-slate-900/50 border-slate-700 text-slate-400'}`}
                                                >
                                                    {level}
                                                    <span className="opacity-50">×{(MULTIPLIERS.risk as any)[level]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-slate-900/50 border border-slate-700/50 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all ${calculations.isHighValue ? 'bg-amber-500/20 text-amber-500' : 'bg-slate-700/20 text-slate-500'}`}>
                                            🔥
                                        </div>
                                        <div>
                                            <h4 className={`text-sm font-black flex items-center gap-2 ${calculations.isHighValue ? 'text-amber-400' : 'text-slate-400'}`}>
                                                High Value Project {calculations.isHighValue && !isHighValueManual && <span className="text-[10px] bg-amber-500/10 px-2 py-0.5 rounded text-amber-500 uppercase tracking-tighter">Auto-Detected</span>}
                                            </h4>
                                            <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">Segmented pricing premium applies higher multiplier</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsHighValueManual(!isHighValueManual)}
                                        className={`w-14 h-7 rounded-full transition-all relative shadow-inner ${isHighValueManual ? 'bg-amber-500' : 'bg-slate-700'}`}
                                    >
                                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-md ${isHighValueManual ? 'left-8' : 'left-1'}`}></div>
                                    </button>
                                </div>
                            </section>
                        </div>

                        {/* Sidebar Results Section */}
                        <div className="lg:col-span-1">
                            <div className="sticky top-6 space-y-6">
                                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 shadow-2xl shadow-blue-900/20 relative overflow-hidden group">
                                    {/* Background Decoration */}
                                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>
                                    
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-center mb-8">
                                            <span className="text-blue-100/70 font-black uppercase tracking-tighter text-xs">Estimated Quote</span>
                                            <div className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black text-white uppercase tracking-widest backdrop-blur-md">
                                                Locked & Safe
                                            </div>
                                        </div>

                                        <div className="mb-8">
                                            <h2 className="text-6xl font-black tabular-nums transition-all">
                                                ₹{calculations.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </h2>
                                            <p className="text-blue-200/60 font-bold mt-2 text-sm tracking-wide">
                                                Safe Quote Range: ₹{(calculations.price * 0.9).toLocaleString(undefined, { maximumFractionDigits: 0 })} – ₹{(calculations.price * 1.1).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </p>
                                        </div>

                                        <div className="space-y-4 pt-6 border-t border-white/10">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-blue-100/60 font-medium tracking-tight">Final Billable Hours</span>
                                                <span className="font-black text-white tabular-nums">{calculations.finalHours.toFixed(1)}h</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-blue-100/60 font-medium tracking-tight">Hourly Rate (₹)</span>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        value={calculations.hourlyRate}
                                                        onChange={(e) => setCustomHourlyRate(parseFloat(e.target.value))}
                                                        className="w-16 bg-white/10 border-none rounded px-2 text-right font-black focus:ring-0 text-xs"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button 
                                            onClick={handleSaveEstimate}
                                            className="w-full mt-8 bg-white text-blue-700 font-black py-4 rounded-2xl shadow-xl hover:bg-blue-50 active:scale-95 transition-all text-sm tracking-widest"
                                        >
                                            SAVE TO HISTORY
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm shadow-xl">
                                    <h4 className="font-black text-xs text-slate-500 uppercase tracking-widest mb-6">Calculation Logic</h4>
                                    <div className="space-y-5">
                                        <div className="flex justify-between items-center group">
                                            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Base Hours</span>
                                            <span className="text-sm font-black text-slate-200 tabular-nums">{calculations.baseHours.toFixed(1)}h</span>
                                        </div>
                                        <div className="flex justify-between items-center group">
                                            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Learning Factor</span>
                                            <span className="text-sm font-black text-green-400">×{calculations.learningFactor.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center group">
                                            <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Margin Buffer</span>
                                            <span className="text-sm font-black text-slate-200">×1.20</span>
                                        </div>
                                        <div className="pt-4 border-t border-slate-700/50 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Global Learning Factor</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-white">{parseFloat(settings.learning_factor).toFixed(3)}</span>
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${parseFloat(settings.learning_factor) < 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                        {parseFloat(settings.learning_factor) < 1 ? 'FAST' : 'BUFFER'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Base Hourly Rate</span>
                                                <span className="text-sm font-black text-white">₹{settings.default_hourly_rate}</span>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center">
                                            <span className="text-xs font-black text-slate-500 uppercase">Efficiency Rating</span>
                                            <span className={`text-xs font-black px-2 py-1 rounded ${calculations.learningFactor < 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {calculations.learningFactor < 1 ? 'HIGHER THAN AVG' : 'LOWER THAN AVG'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900/50">
                                    <th className="px-8 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Project / Date</th>
                                    <th className="px-8 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Estimation</th>
                                    <th className="px-8 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Outcome</th>
                                    <th className="px-8 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Performance</th>
                                    <th className="px-8 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {history.map(project => (
                                    <tr key={project.id} className="hover:bg-slate-700/20 transition-colors group">
                                        <td className="px-8 py-6">
                                            <div className="font-black text-slate-200 group-hover:text-blue-400 transition-colors">{project.name}</div>
                                            <div className="text-xs text-slate-500 mt-1 font-medium">{project.project_type} • {new Date(project.created_at).toLocaleDateString()}</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="font-black text-slate-200">₹{project.estimated_price.toLocaleString()}</div>
                                            <div className="text-xs text-slate-500 font-medium">{project.final_hours.toFixed(1)} hours est.</div>
                                        </td>
                                        <td className="px-8 py-6">
                                            {project.is_completed ? (
                                                <>
                                                    <div className="font-black text-slate-200">₹{project.actual_price?.toLocaleString()}</div>
                                                    <div className="text-xs text-slate-500 font-medium">{project.actual_hours?.toFixed(1)} hours actual</div>
                                                </>
                                            ) : (
                                                <span className="text-xs font-bold text-amber-500/80 bg-amber-500/10 px-3 py-1 rounded-full uppercase tracking-tighter">In Progress</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            {project.is_completed ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className={`text-sm font-black ${project.ratio! <= 1.0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {project.ratio! <= 1.0 
                                                            ? `↑ Faster (${((1 - project.ratio!) * 100).toFixed(0)}%)` 
                                                            : `↓ Slower (${((project.ratio! - 1) * 100).toFixed(0)}%)`}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Yield:</span>
                                                        <span className="text-[10px] font-black text-blue-400">₹{(project.actual_price! / project.actual_hours!).toFixed(0)}/hr</span>
                                                    </div>
                                                    {project.estimated_price > project.actual_price! && (
                                                        <div className="text-[10px] font-black text-red-500 uppercase tracking-tighter flex items-center gap-1">
                                                            ⚠️ Lost Potential: ₹{(project.estimated_price - project.actual_price!).toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-600 italic">Pending data...</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6">
                                            {!project.is_completed && (
                                                <button 
                                                    onClick={() => handleLogActuals(project)}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black py-2 px-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all uppercase tracking-widest"
                                                >
                                                    FINALIZE & LEARN
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {history.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-20 text-center text-slate-500">
                                            <div className="text-4xl mb-4 opacity-20">🕳️</div>
                                            <div className="font-bold text-lg">No history yet</div>
                                            <p className="text-sm max-w-xs mx-auto mt-2">Start a new estimate to begin training your personal intelligence engine.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'modules' && (
                    <div className="space-y-8">
                        {/* Create Module Form */}
                        <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
                             <h3 className="text-xl font-bold mb-6">Create New Module</h3>
                             <form onSubmit={async (e) => {
                                 e.preventDefault();
                                 const target = e.target as any;
                                 const name = target.moduleName.value;
                                 const hours = parseFloat(target.moduleHours.value);
                                 if (!name || isNaN(hours)) return;
                                 try {
                                     await invoke('create_estimator_module', { name, hours });
                                     Swal.fire('Success', 'Module added!', 'success');
                                     target.reset();
                                     fetchData();
                                 } catch (error) {
                                     Swal.fire('Error', String(error), 'error');
                                 }
                             }} className="flex flex-col md:flex-row gap-4 items-end">
                                 <div className="flex-1 space-y-2">
                                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Module Name</label>
                                     <input name="moduleName" type="text" placeholder="e.g. User Profile Page" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3" />
                                 </div>
                                 <div className="w-full md:w-32 space-y-2">
                                     <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Base Hours</label>
                                     <input name="moduleHours" type="number" step="0.5" placeholder="8" className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3" />
                                 </div>
                                 <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-xl transition-all">
                                     ADD MODULE
                                 </button>
                             </form>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {modules.map(module => (
                                <div key={module.id} className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-6 backdrop-blur-sm shadow-xl flex flex-col justify-between hover:border-blue-500/30 transition-all group">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h4 className="text-lg font-black text-slate-200 mb-1">{module.name}</h4>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={async () => {
                                                        const { value: formValues } = await Swal.fire({
                                                            title: 'Edit Module',
                                                            html:
                                                                `<input id="swal-input1" class="swal2-input" placeholder="Name" value="${module.name}">` +
                                                                `<input id="swal-input2" class="swal2-input" type="number" placeholder="Avg Hours" value="${module.avg_hours}">`,
                                                            focusConfirm: false,
                                                            showCancelButton: true,
                                                            preConfirm: () => {
                                                                return [
                                                                    (document.getElementById('swal-input1') as HTMLInputElement).value,
                                                                    (document.getElementById('swal-input2') as HTMLInputElement).value
                                                                ]
                                                            }
                                                        });
                                                        if (formValues) {
                                                            try {
                                                                await invoke('update_estimator_module', { id: module.id, name: formValues[0], hours: parseFloat(formValues[1]) });
                                                                fetchData();
                                                            } catch (e) { Swal.fire('Error', String(e), 'error'); }
                                                        }
                                                    }}
                                                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                </button>
                                                <button 
                                                    onClick={async () => {
                                                        const result = await Swal.fire({
                                                            title: 'Delete Module?',
                                                            text: "This will remove it from the estimator lists.",
                                                            icon: 'warning',
                                                            showCancelButton: true,
                                                            confirmButtonColor: '#ef4444',
                                                            confirmButtonText: 'Yes, delete it!'
                                                        });
                                                        if (result.isConfirmed) {
                                                            try {
                                                                await invoke('delete_estimator_module', { id: module.id });
                                                                fetchData();
                                                            } catch (e) { Swal.fire('Error', String(e), 'error'); }
                                                        }
                                                    }}
                                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium mb-6">{module.usage_count} data points collected</p>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Base Estimate</span>
                                            <h3 className="text-3xl font-black text-blue-400 tabular-nums">{module.avg_hours.toFixed(1)}h</h3>
                                        </div>
                                        <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${module.usage_count > 5 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                            {module.usage_count > 5 ? 'STABLE DATA' : 'COLLECTING DATA'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'system' && (
                    <div className="max-w-3xl mx-auto space-y-8 pb-20">
                        <section className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-8 backdrop-blur-sm shadow-2xl">
                             <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h3 className="text-2xl font-black">Economic Calibration</h3>
                                    <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest font-black">Segmented Learning Loop v2.0</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">High-Value Zone</div>
                                    <div className="text-lg font-black text-amber-500">≥ ₹{parseFloat(settings.market_premium_threshold || '20000').toLocaleString()}</div>
                                </div>
                             </div>
                            
                            <div className="space-y-12">
                                {/* Standard Calibration */}
                                <div className="space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-black text-slate-200">STANDARD PRICING POWER</h4>
                                                {(() => {
                                                    const cur = parseFloat(settings.market_premium || '1.0');
                                                    const old = parseFloat(settings.market_premium_old || '1.0');
                                                    if (cur > old + 0.02) return <span className="text-emerald-500">↑</span>;
                                                    if (cur < old - 0.02) return <span className="text-red-500">↓</span>;
                                                    return <span className="text-slate-500">→</span>;
                                                })()}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence:</div>
                                                <div className="w-20 h-1 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${Math.min((parseInt(settings.market_premium_standard_count || '0') / 20) * 100, 100)}%` }}></div>
                                                </div>
                                                <span className="text-[9px] font-black text-slate-400 uppercase">{Math.min((parseInt(settings.market_premium_standard_count || '0') / 20) * 100, 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-3xl font-black text-blue-400">x{parseFloat(settings.market_premium || '1.0').toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <input 
                                        type="range" min="0.8" max="1.8" step="0.01"
                                        value={parseFloat(settings.market_premium || '1.0')}
                                        onChange={async (e) => {
                                            await invoke('update_estimator_setting', { key: 'market_premium', value: e.target.value });
                                            fetchData();
                                        }}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                </div>

                                {/* High-Value Calibration */}
                                <div className="space-y-6 pt-10 border-t border-slate-700/30">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-black text-amber-500">HIGH-VALUE PRICING POWER</h4>
                                                {(() => {
                                                    const cur = parseFloat(settings.market_premium_high_value || '1.2');
                                                    const old = parseFloat(settings.market_premium_high_value_old || '1.2');
                                                    if (cur > old + 0.02) return <span className="text-emerald-500">↑</span>;
                                                    if (cur < old - 0.02) return <span className="text-red-500">↓</span>;
                                                    return <span className="text-slate-500">→</span>;
                                                })()}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confidence:</div>
                                                <div className="w-20 h-1 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-amber-500" style={{ width: `${Math.min((parseInt(settings.market_premium_high_value_count || '0') / 20) * 100, 100)}%` }}></div>
                                                </div>
                                                <span className="text-[9px] font-black text-slate-400 uppercase">{Math.min((parseInt(settings.market_premium_high_value_count || '0') / 20) * 100, 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-3xl font-black text-amber-500">x{parseFloat(settings.market_premium_high_value || '1.2').toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <input 
                                        type="range" min="0.8" max="1.8" step="0.01"
                                        value={parseFloat(settings.market_premium_high_value || '1.2')}
                                        onChange={async (e) => {
                                            await invoke('update_estimator_setting', { key: 'market_premium_high_value', value: e.target.value });
                                            fetchData();
                                        }}
                                        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                    />
                                </div>

                                {/* Global Parameters */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-10 border-t border-slate-700/30">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Base Speed Factor</label>
                                        <div className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                                            <div className="text-2xl font-black text-blue-400">{parseFloat(settings.learning_factor).toFixed(3)}</div>
                                            <p className="text-[10px] text-slate-500 leading-tight uppercase font-black">Speed Calibration vs Benchmark</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Default Base Rate</label>
                                        <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-2xl border border-slate-700/50">
                                            <span className="text-slate-500 font-bold ml-2">₹</span>
                                            <input 
                                                type="number" 
                                                value={settings.default_hourly_rate}
                                                onChange={async (e) => {
                                                    await invoke('update_estimator_setting', { key: 'default_hourly_rate', value: e.target.value });
                                                    fetchData();
                                                }}
                                                className="w-full bg-transparent border-none font-black text-xl focus:ring-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-blue-600/10 border border-blue-500/20 rounded-3xl">
                                <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                    Signal Weighted EMA
                                </h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                    Your pricing power updates every time you finish a project. 
                                    High-confidence projects (close to suggested price) have 100% signal. 
                                    "Bad deals" (&lt; 50% price) are filtered to 20% signal to protect your model.
                                </p>
                            </div>
                             <div className="p-6 bg-amber-600/10 border border-amber-500/20 rounded-3xl">
                                <h4 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                    📈 Market Evolution
                                </h4>
                                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                    The High-Value threshold is dynamic. It moves with your success, 
                                    ensuring your target segment always pushes your negotiation boundaries.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
