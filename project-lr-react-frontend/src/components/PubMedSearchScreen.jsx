import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { Loader2, BookOpen } from 'lucide-react';

function PubMedSearchScreen() {
    const navigate = useNavigate();
    const {
        selectedPatentKeywords,
        userAddedKeywords,
        searchParams,
        setPubmedResults,
        setKeywordsPerDatabase
    } = useSearch();

    const [status, setStatus] = useState('Preparing PubMed search...');
    const [error, setError] = useState(null);
    const hasRun = useRef(false);

    useEffect(() => {
        // Prevent double execution in React StrictMode
        if (hasRun.current) return;
        hasRun.current = true;
        performPubMedSearch();
    }, []);

    const performPubMedSearch = async () => {
        try {
            // Combine: original keywords + selected extracted keywords + user added keywords
            const allKeywords = [
                ...(searchParams?.keywords || []),
                ...Array.from(selectedPatentKeywords),
                ...userAddedKeywords
            ];

            const uniqueKeywords = [...new Set(allKeywords)];

            if (uniqueKeywords.length === 0) {
                setError('No keywords available. Please go back and add keywords.');
                return;
            }

            console.log('PubMed search with keywords:', uniqueKeywords);
            setKeywordsPerDatabase(prev => ({ ...prev, PubMed: uniqueKeywords }));

            setStatus(`Searching PubMed with ${uniqueKeywords.length} keywords...`);
            const NODE_BACKEND = import.meta.env.VITE_NODE_BACKEND_URL || 'http://localhost:3000';
            const query = uniqueKeywords.join(', ');

            const response = await fetch(`${NODE_BACKEND}/api/pubmed-public/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    from: searchParams?.dateRange?.start || null,
                    to: searchParams?.dateRange?.end || null,
                    maxResults: 100
                })
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle rate limit or other errors gracefully
                if (response.status === 429 || (data.error && data.error.includes('429'))) {
                    setError('PubMed rate limit reached. Please wait a moment and try again.');
                    return;
                }
                throw new Error(data.error || `PubMed search failed: ${response.statusText}`);
            }

            console.log('PubMed results:', data.count);
            setPubmedResults(data.results || []);

            setStatus('Search complete! Redirecting...');
            setTimeout(() => navigate('/pubmed-results'), 1000);

        } catch (err) {
            console.error('PubMed search failed:', err);
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-xl p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-6">
                    <BookOpen className="w-8 h-8 text-gray-700" />
                </div>

                <h1 className="text-xl font-bold text-gray-900 mb-2">
                    PubMed Search
                </h1>

                {error ? (
                    <div className="mt-4">
                        <p className="text-red-600 mb-4">{error}</p>
                        <button
                            onClick={() => navigate('/patent-results')}
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

export default PubMedSearchScreen;
