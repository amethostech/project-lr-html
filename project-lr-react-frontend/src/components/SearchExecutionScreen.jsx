import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Database, FileText, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';

function SearchExecutionScreen() {
    const navigate = useNavigate();
    const { searchParams } = useSearch();
    const [progress, setProgress] = useState(0);

    // Guard clause: if no params (direct access), redirect to home
    useEffect(() => {
        if (!searchParams || searchParams.keywords.length === 0) {
            navigate('/');
        }
    }, [searchParams, navigate]);

    const [statuses, setStatuses] = useState({
        USPTO: 'pending',
        PubMed: 'pending',
        ClinicalTrials: 'pending'
    });

    useEffect(() => {
        if (!searchParams) return;

        // Total duration for the simulation
        const TOTAL_DURATION = 3000;
        const INTERVAL = 50;
        const steps = TOTAL_DURATION / INTERVAL;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            const newProgress = Math.min((currentStep / steps) * 100, 100);
            setProgress(newProgress);

            // Simulate database status updates based on progress
            setStatuses(prev => {
                const next = { ...prev };

                // USPTO: 0-30%
                if (newProgress < 30) {
                    if (searchParams.databases.USPTO) next.USPTO = 'searching';
                } else if (newProgress >= 30) {
                    if (searchParams.databases.USPTO) next.USPTO = 'completed';
                }

                // PubMed: 30-70%
                if (newProgress >= 30 && newProgress < 70) {
                    if (searchParams.databases.PubMed) next.PubMed = 'searching';
                } else if (newProgress >= 70) {
                    if (searchParams.databases.PubMed) next.PubMed = 'completed';
                }

                // ClinicalTrials: 70-100%
                if (newProgress >= 70 && newProgress < 95) {
                    if (searchParams.databases.ClinicalTrials) next.ClinicalTrials = 'searching';
                } else if (newProgress >= 95) {
                    if (searchParams.databases.ClinicalTrials) next.ClinicalTrials = 'completed';
                }

                return next;
            });

            if (currentStep >= steps) {
                clearInterval(timer);
                setTimeout(() => {
                    navigate('/patents');
                }, 500); // Small delay before transition
            }
        }, INTERVAL);

        return () => clearInterval(timer);
    }, [searchParams, navigate]);

    if (!searchParams) return null; // or loading spinner

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-xl p-10 text-center">

                {/* Progress Circle */}
                <div className="relative inline-flex items-center justify-center mb-8">
                    <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                            className="text-gray-100"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                            r="58"
                            cx="64"
                            cy="64"
                        />
                        <circle
                            className="text-gray-900 transition-all duration-300 ease-linear"
                            strokeWidth="8"
                            strokeDasharray={365}
                            strokeDashoffset={365 - (365 * progress) / 100}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r="58"
                            cx="64"
                            cy="64"
                        />
                    </svg>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <span className="text-2xl font-bold text-gray-900">{Math.round(progress)}%</span>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">Running Search...</h2>
                <p className="text-gray-500 mb-8">
                    Querying {searchParams.keywords.length} keyword(s) from {searchParams.dateRange.start || '...'} to {searchParams.dateRange.end || '...'}
                </p>

                {/* Database Status List */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-8 text-left border border-gray-100">
                    {/* USPTO */}
                    {searchParams.databases?.USPTO && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Database className={`w-4 h-4 ${statuses.USPTO === 'completed' ? 'text-gray-900' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${statuses.USPTO === 'completed' ? 'text-gray-900' : 'text-gray-500'}`}>
                                    USPTO (Patents)
                                </span>
                            </div>
                            {statuses.USPTO === 'searching' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                            {statuses.USPTO === 'completed' && <CheckCircle className="w-4 h-4 text-green-600" />}
                            {statuses.USPTO === 'pending' && <span className="w-2 h-2 rounded-full bg-gray-200"></span>}
                        </div>
                    )}

                    {/* PubMed */}
                    {searchParams.databases?.PubMed && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FileText className={`w-4 h-4 ${statuses.PubMed === 'completed' ? 'text-gray-900' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${statuses.PubMed === 'completed' ? 'text-gray-900' : 'text-gray-500'}`}>
                                    PubMed (Literature)
                                </span>
                            </div>
                            {statuses.PubMed === 'searching' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                            {statuses.PubMed === 'completed' && <CheckCircle className="w-4 h-4 text-green-600" />}
                            {statuses.PubMed === 'pending' && <span className="w-2 h-2 rounded-full bg-gray-200"></span>}
                        </div>
                    )}

                    {/* ClinicalTrials */}
                    {searchParams.databases?.ClinicalTrials && (
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Activity className={`w-4 h-4 ${statuses.ClinicalTrials === 'completed' ? 'text-gray-900' : 'text-gray-400'}`} />
                                <span className={`text-sm font-medium ${statuses.ClinicalTrials === 'completed' ? 'text-gray-900' : 'text-gray-500'}`}>
                                    ClinicalTrials.gov
                                </span>
                            </div>
                            {statuses.ClinicalTrials === 'searching' && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                            {statuses.ClinicalTrials === 'completed' && <CheckCircle className="w-4 h-4 text-green-600" />}
                            {statuses.ClinicalTrials === 'pending' && <span className="w-2 h-2 rounded-full bg-gray-200"></span>}
                        </div>
                    )}
                </div>

                <div className="flex justify-center">
                    <button
                        className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
                        onClick={() => window.location.reload()} // Quick reset for demo
                    >
                        Cancel Search
                    </button>
                </div>

            </div>
        </div>
    );
}

export default SearchExecutionScreen;
