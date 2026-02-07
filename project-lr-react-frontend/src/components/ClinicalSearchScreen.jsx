import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { Loader2, Activity, Search } from 'lucide-react';

function ClinicalSearchScreen() {
    const navigate = useNavigate();
    const {
        selectedPubmedKeywords,
        keywordsPerDatabase,
        searchParams,
        setClinicalResults,
        setKeywordsPerDatabase
    } = useSearch();

    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [operator, setOperator] = useState(searchParams?.operator || 'OR');

    const allKeywords = [
        ...(keywordsPerDatabase?.PubMed || []),
        ...Array.from(selectedPubmedKeywords)
    ];

    if (allKeywords.length === 0 && searchParams?.keywords?.length > 0) {
        allKeywords.push(...searchParams.keywords);
    }
    const uniqueKeywords = [...new Set(allKeywords)];

    const performClinicalSearch = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (uniqueKeywords.length === 0) {
                setError('No keywords available for search.');
                return;
            }

            console.log('Clinical Trials search with keywords:', uniqueKeywords, 'operator:', operator);
            setKeywordsPerDatabase(prev => ({ ...prev, ClinicalTrials: uniqueKeywords }));

            setStatus(`Searching Clinical Trials...`);
            const NODE_BACKEND = import.meta.env.VITE_NODE_BACKEND_URL || 'http://localhost:3000';
            // We slice for Clinical Trials as it often errors with too many long terms
            const query = uniqueKeywords.slice(0, 5).join(', ');

            const response = await fetch(`${NODE_BACKEND}/api/clinical/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    operator: operator,
                    maxResults: 100
                })
            });

            if (!response.ok) {
                throw new Error(`Clinical Trials search failed: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Clinical Trials results:', data.count);
            setClinicalResults(data.results || []);

            setStatus('Search complete! Redirecting...');
            setTimeout(() => navigate('/final-results'), 1000);

        } catch (err) {
            console.error('Clinical Trials search failed:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                        <Activity className="w-8 h-8 text-gray-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Clinical Trials Search</h1>
                    <p className="text-gray-500 text-sm mt-1">Refine your clinical search logic</p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Keywords to search:</label>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200 max-h-32 overflow-y-auto">
                        {uniqueKeywords.map((kw, i) => (
                            <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-700 font-medium">
                                {kw}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Keyword Matching Logic
                    </label>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setOperator('OR')}
                            disabled={isLoading}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${operator === 'OR'
                                    ? 'bg-gray-900 text-white shadow-md'
                                    : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-900'
                                }`}
                        >
                            OR (Any)
                        </button>
                        <button
                            onClick={() => setOperator('AND')}
                            disabled={isLoading}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${operator === 'AND'
                                    ? 'bg-gray-900 text-white shadow-md'
                                    : 'bg-white text-gray-600 border border-gray-300 hover:border-gray-900'
                                }`}
                        >
                            AND (All)
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                        {operator === 'OR'
                            ? 'Broad search: Find trials with at least one keyword.'
                            : 'Strict search: Find trials containing every keyword.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                        {error}
                    </div>
                )}

                {status && !error && (
                    <div className="mb-6 flex items-center justify-center gap-2 text-gray-600 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {status}
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/pubmed-results')}
                        disabled={isLoading}
                        className="flex-1 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50"
                    >
                        Go Back
                    </button>
                    <button
                        onClick={performClinicalSearch}
                        disabled={isLoading || uniqueKeywords.length === 0}
                        className="flex-[2] py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 disabled:bg-gray-300 flex items-center justify-center gap-2 transition-all"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        Run Clinical Search
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ClinicalSearchScreen;
