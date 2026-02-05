import { useState } from 'react';
import { Plus, X, Search, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';

const MAX_KEYWORDS = 5;

function InitialSearchSetup() {
    const navigate = useNavigate();
    const { setSearchParams, setPatentResults, setKeywordsPerDatabase } = useSearch();
    const [isLoading, setIsLoading] = useState(false);

    const [keywords, setKeywords] = useState([]);
    const [keywordInput, setKeywordInput] = useState('');
    const [keywordError, setKeywordError] = useState('');

    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [submitError, setSubmitError] = useState('');

    const handleAddKeyword = () => {
        const trimmedKeyword = keywordInput.trim();
        if (!trimmedKeyword) return;
        if (keywords.length >= MAX_KEYWORDS) {
            setKeywordError(`Maximum of ${MAX_KEYWORDS} keywords allowed.`);
            return;
        }
        if (keywords.includes(trimmedKeyword)) {
            setKeywordError('This keyword has already been added.');
            return;
        }
        setKeywords([...keywords, trimmedKeyword]);
        setKeywordInput('');
        setKeywordError('');
        setSubmitError('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); }
    };

    const handleRemoveKeyword = (keywordToRemove) => {
        setKeywords(keywords.filter(k => k !== keywordToRemove));
        setKeywordError('');
    };

    const handleDateChange = (field, value) => {
        setDateRange(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        if (keywords.length === 0) {
            setSubmitError('Please add at least one keyword to proceed.');
            return;
        }

        setIsLoading(true);
        setSubmitError('');

        const params = { keywords, dateRange };
        setSearchParams(params);

        try {
            const queryText = keywords.join(', ');
            const NODE_BACKEND = import.meta.env.VITE_NODE_BACKEND_URL || 'http://localhost:3000';
            console.log("Starting USPTO Search via Node.js:", { keywords, dateRange });

            const payload = {
                keywords: keywords,
                year: dateRange.start || 2024,
                size: 100
            };

            const response = await fetch(`${NODE_BACKEND}/api/uspto-public/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`USPTO Search failed: ${response.statusText}`);
            }

            const data = await response.json();
            setPatentResults(data.results || []);
            setKeywordsPerDatabase(prev => ({ ...prev, USPTO: keywords }));

            navigate('/patent-results');

        } catch (error) {
            console.error("Search failed:", error);
            setSubmitError(`Search failed: ${error.message}. Is the backend running?`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-xl mb-4">
                        <Search className="w-7 h-7 text-gray-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Patent & Literature Discovery
                    </h1>
                    <p className="text-gray-500 text-sm">
                        Step 1: Search USPTO Patents
                    </p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Keywords ({keywords.length}/{MAX_KEYWORDS})
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter a keyword..."
                            disabled={isLoading}
                            className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100"
                        />
                        <button
                            onClick={handleAddKeyword}
                            disabled={isLoading || keywords.length >= MAX_KEYWORDS}
                            className="px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>
                    {keywordError && (
                        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> {keywordError}
                        </p>
                    )}
                </div>

                {keywords.length > 0 && (
                    <div className="mb-6">
                        <div className="flex flex-wrap gap-2">
                            {keywords.map((keyword, index) => (
                                <span
                                    key={index}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-900 rounded-full text-sm font-medium border border-gray-200"
                                >
                                    {keyword}
                                    <button
                                        onClick={() => handleRemoveKeyword(keyword)}
                                        disabled={isLoading}
                                        className="text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Year Range
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="number"
                            value={dateRange.start}
                            onChange={(e) => handleDateChange('start', e.target.value)}
                            placeholder="Start Year"
                            min="1900"
                            max="2099"
                            disabled={isLoading}
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100"
                        />
                        <input
                            type="number"
                            value={dateRange.end}
                            onChange={(e) => handleDateChange('end', e.target.value)}
                            placeholder="End Year"
                            min="1900"
                            max="2099"
                            disabled={isLoading}
                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100"
                        />
                    </div>
                </div>

                {/* Database Source - Locked to USPTO */}
                <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Database Source
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-gray-100 border border-gray-300 rounded-lg cursor-not-allowed">
                        <input
                            type="checkbox"
                            checked={true}
                            disabled={true}
                            className="w-5 h-5 rounded border-gray-300 bg-gray-200 text-gray-900"
                        />
                        <span className="text-gray-900 font-medium">USPTO</span>
                        <span className="text-gray-500 text-sm">(Patents - Required first step)</span>
                    </label>
                </div>

                {submitError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                        <p className="text-red-800 text-sm">{submitError}</p>
                    </div>
                )}

                <button
                    onClick={handleSubmit}
                    disabled={isLoading || keywords.length === 0}
                    className="w-full py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Searching USPTO...
                        </>
                    ) : (
                        <>
                            <Search className="w-5 h-5" />
                            Search Patents
                        </>
                    )}
                </button>

                <p className="text-center text-gray-400 text-xs mt-4">
                    We'll extract keywords from patent results for the next step
                </p>
            </div>
        </div>
    );
}

export default InitialSearchSetup;
