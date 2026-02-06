import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { Loader2, Activity } from 'lucide-react';

function ClinicalSearchScreen() {
    const navigate = useNavigate();
    const {
        selectedPubmedKeywords,
        keywordsPerDatabase,
        searchParams,
        setClinicalResults,
        setKeywordsPerDatabase
    } = useSearch();

    const [status, setStatus] = useState('Preparing Clinical Trials search...');
    const [error, setError] = useState(null);
    const hasRun = useRef(false);

    useEffect(() => {
        // Prevent double execution in React StrictMode
        if (hasRun.current) return;
        hasRun.current = true;
        performClinicalSearch();
    }, []);

    const performClinicalSearch = async () => {
        try {
            const allKeywords = [
                ...(keywordsPerDatabase?.PubMed || []),
                ...Array.from(selectedPubmedKeywords)
            ];

            if (allKeywords.length === 0 && searchParams?.keywords?.length > 0) {
                allKeywords.push(...searchParams.keywords);
            }

            const uniqueKeywords = [...new Set(allKeywords)];

            if (uniqueKeywords.length === 0) {
                setError('No keywords available for search.');
                return;
            }

            console.log('Clinical Trials search with keywords:', uniqueKeywords);
            setKeywordsPerDatabase(prev => ({ ...prev, ClinicalTrials: uniqueKeywords }));

            setStatus(`Searching Clinical Trials with ${uniqueKeywords.length} keywords...`);
            const NODE_BACKEND = import.meta.env.VITE_NODE_BACKEND_URL || 'http://localhost:3000';
            const query = uniqueKeywords.slice(0, 3).join(', ');

            const response = await fetch(`${NODE_BACKEND}/api/clinical/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    operator: searchParams?.operator || 'OR',
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
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-6">
                    <Activity className="w-8 h-8 text-gray-700" />
                </div>

                <h1 className="text-xl font-bold text-gray-900 mb-2">
                    Clinical Trials Search
                </h1>

                {error ? (
                    <div className="mt-4">
                        <p className="text-red-600 mb-4">{error}</p>
                        <button
                            onClick={() => navigate('/pubmed-results')}
                            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                        >
                            Go Back
                        </button>
                    </div>
                ) : (
                    <div className="mt-4">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500">{status}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ClinicalSearchScreen;
