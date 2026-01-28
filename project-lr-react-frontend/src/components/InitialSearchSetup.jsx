import { useState } from 'react';
import { Plus, X, Search, AlertCircle, Database, FileText, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';

const MAX_KEYWORDS = 5;

function InitialSearchSetup() {
    const navigate = useNavigate();
    const { setSearchParams } = useSearch();

    // State for keywords
    const [keywords, setKeywords] = useState([]);
    const [keywordInput, setKeywordInput] = useState('');
    const [keywordError, setKeywordError] = useState('');

    // State for date range
    const [dateRange, setDateRange] = useState({
        start: '',
        end: ''
    });

    // State for database selection
    const [databases, setDatabases] = useState({
        USPTO: true,
        PubMed: true,
        ClinicalTrials: true
    });

    // Validation error for submission
    const [submitError, setSubmitError] = useState('');

    // Handle adding a keyword
    const handleAddKeyword = () => {
        const trimmedKeyword = keywordInput.trim();

        if (!trimmedKeyword) {
            return;
        }

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

    // Handle Enter key press for adding keywords
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); }
    };

    // Handle removing a keyword
    const handleRemoveKeyword = (keywordToRemove) => {
        setKeywords(keywords.filter(k => k !== keywordToRemove));
        setKeywordError('');
    };

    // Handle database checkbox toggle
    const handleDatabaseChange = (database) => {
        setDatabases(prev => ({
            ...prev,
            [database]: !prev[database]
        }));
    };

    // Handle date range changes
    const handleDateChange = (field, value) => {
        setDateRange(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle form submission
    const handleSubmit = () => {
        if (keywords.length === 0) {
            setSubmitError('Please add at least one keyword to proceed.');
            return;
        }

        const params = {
            keywords,
            dateRange,
            databases
        };

        setSearchParams(params); // Save to context
        navigate('/search'); // Navigate to next screen
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-xl p-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-100 rounded-xl mb-4">
                        <Search className="w-7 h-7 text-gray-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        Patent & Literature Discovery
                    </h1>
                    <p className="text-gray-500 text-sm">
                        Define your search parameters to query external databases
                    </p>
                </div>

                {/* Keyword Input Section */}
                <div className="mb-8">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Keywords
                        <span className="ml-2 text-gray-400 font-normal">
                            ({keywords.length}/{MAX_KEYWORDS})
                        </span>
                    </label>

                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={keywordInput}
                            onChange={(e) => {
                                setKeywordInput(e.target.value);
                                setKeywordError('');
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="e.g., Karuna Therapeutics"
                            className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                        />
                        <button
                            onClick={handleAddKeyword}
                            disabled={keywords.length >= MAX_KEYWORDS}
                            className="px-4 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            Add
                        </button>
                    </div>

                    {/* Keyword Error Message */}
                    {keywordError && (
                        <div className="flex items-center gap-2 text-red-600 text-sm mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {keywordError}
                        </div>
                    )}

                    {/* Keywords Chips */}
                    {keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {keywords.map((keyword, index) => (
                                <span
                                    key={index}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-200 text-gray-700 rounded-full text-sm"
                                >
                                    {keyword}
                                    <button
                                        onClick={() => handleRemoveKeyword(keyword)}
                                        className="hover:bg-gray-200 rounded-full p-0.5 transition-colors"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-6"></div>

                {/* Search Parameters Section */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Parameters</h2>

                    {/* Year Range */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Year Range
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <input
                                    type="number"
                                    value={dateRange.start}
                                    onChange={(e) => handleDateChange('start', e.target.value)}
                                    placeholder="Start Year"
                                    min="1900"
                                    max="2099"
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <input
                                    type="number"
                                    value={dateRange.end}
                                    onChange={(e) => handleDateChange('end', e.target.value)}
                                    placeholder="End Year"
                                    min="1900"
                                    max="2099"
                                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Database Sources */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                            Database Sources
                        </label>
                        <div className="space-y-3">
                            {/* USPTO */}
                            <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={databases.USPTO}
                                    onChange={() => handleDatabaseChange('USPTO')}
                                    className="w-5 h-5 rounded border-gray-300 bg-white text-gray-900 focus:ring-gray-900 focus:ring-offset-0"
                                />
                                <Database className="w-5 h-5 text-gray-600" />
                                <span className="text-gray-900">USPTO</span>
                                <span className="text-gray-500 text-sm">(Patents)</span>
                            </label>

                            {/* PubMed */}
                            <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={databases.PubMed}
                                    onChange={() => handleDatabaseChange('PubMed')}
                                    className="w-5 h-5 rounded border-gray-300 bg-white text-gray-900 focus:ring-gray-900 focus:ring-offset-0"
                                />
                                <FileText className="w-5 h-5 text-gray-600" />
                                <span className="text-gray-900">PubMed</span>
                                <span className="text-gray-500 text-sm">(Literature)</span>
                            </label>

                            {/* ClinicalTrials.gov */}
                            <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={databases.ClinicalTrials}
                                    onChange={() => handleDatabaseChange('ClinicalTrials')}
                                    className="w-5 h-5 rounded border-gray-300 bg-white text-gray-900 focus:ring-gray-900 focus:ring-offset-0"
                                />
                                <Activity className="w-5 h-5 text-gray-600" />
                                <span className="text-gray-900">ClinicalTrials.gov</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Submit Error Message */}
                {submitError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {submitError}
                    </div>
                )}

                {/* Footer/Action */}
                <button
                    onClick={handleSubmit}
                    className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                    <Search className="w-5 h-5" />
                    Proceed to Search
                </button>
            </div>
        </div>
    );
}

export default InitialSearchSetup;
