import { useState, useMemo } from 'react';
import { ArrowRight, BarChart3, Check, MinusCircle, Plus, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';

// Mock Data
const MOCK_SUGGESTIONS = [
    { id: 1, keyword: "Muscarinic agonist", source: "US11564998B2", relevanceScore: 0.98 },
    { id: 2, keyword: "Xanomeline", source: "US11564998B2", relevanceScore: 0.95 },
    { id: 3, keyword: "Trospium chloride", source: "US11285145B2", relevanceScore: 0.92 },
    { id: 4, keyword: "M1 receptor selectivity", source: "Abstract Analysis", relevanceScore: 0.88 },
    { id: 5, keyword: "Cholinergic modulation", source: "Patent Classifications", relevanceScore: 0.76 },
    { id: 6, keyword: "Antipsychotic efficacy", source: "Clinical Data", relevanceScore: 0.72 },
    { id: 7, keyword: "Transdermal delivery", source: "US10543201B2", relevanceScore: 0.65 },
    { id: 8, keyword: "Neurodegenerative diseases", source: "Broader Context", relevanceScore: 0.55 },
];

function KeywordRefinementScreen() {
    const navigate = useNavigate();
    const { searchParams, setRefinedKeywords } = useSearch();
    const originalKeywords = searchParams?.keywords || [];

    const [selectedIds, setSelectedIds] = useState(new Set([1, 2])); // Pre-select top 2 for convenience
    const [sortOrder, setSortOrder] = useState('relevance'); // 'relevance' | 'alpha'

    // Calculations
    const sortedSuggestions = useMemo(() => {
        return [...MOCK_SUGGESTIONS].sort((a, b) => {
            if (sortOrder === 'relevance') return b.relevanceScore - a.relevanceScore;
            return a.keyword.localeCompare(b.keyword);
        });
    }, [sortOrder]);

    const finalKeywords = [
        ...originalKeywords,
        ...MOCK_SUGGESTIONS.filter(k => selectedIds.has(k.id)).map(k => k.keyword)
    ];

    // Handlers
    const toggleSelection = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(MOCK_SUGGESTIONS.map(s => s.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const isAllSelected = MOCK_SUGGESTIONS.length > 0 && selectedIds.size === MOCK_SUGGESTIONS.length;

    const getRelevanceColor = (score) => {
        if (score >= 0.9) return 'bg-green-500';
        if (score >= 0.7) return 'bg-blue-500';
        return 'bg-yellow-500';
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-6">
            <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Refine Keyword Set</h1>
                    <p className="text-gray-500">
                        We analyzed your patent selection and extracted the following high-value terms.
                        Add them to improve your upcoming Literature Search.
                    </p>
                </div>

                {/* Main Content - Split View */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left: Suggested Keywords List (2 cols wide) */}
                    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                                />
                                <span className="font-semibold text-gray-700 text-sm">Select All Suggestions</span>
                            </div>
                            <select
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                                className="text-sm border-gray-200 rounded-lg text-gray-600 focus:ring-gray-900 focus:border-gray-900 bg-white"
                            >
                                <option value="relevance">Sort by Relevance</option>
                                <option value="alpha">Sort A-Z</option>
                            </select>
                        </div>

                        <div className="overflow-y-auto flex-1 p-2">
                            <div className="grid grid-cols-1 gap-2">
                                {sortedSuggestions.map((item) => {
                                    const isSelected = selectedIds.has(item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleSelection(item.id)}
                                            className={`
                        group flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all
                        ${isSelected
                                                    ? 'bg-blue-50 border-blue-200'
                                                    : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm'}
                      `}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`
                          w-5 h-5 rounded flex items-center justify-center border transition-colors
                          ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300 group-hover:border-gray-400'}
                        `}>
                                                    {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                                <div>
                                                    <p className={`font-medium ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                                        {item.keyword}
                                                    </p>
                                                    <p className="text-xs text-gray-500">Source: {item.source}</p>
                                                </div>
                                            </div>

                                            {/* Relevance Badge */}
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="text-xs font-semibold text-gray-700">{(item.relevanceScore * 100).toFixed(0)}%</span>
                                                    <span className="text-[10px] text-gray-400 block uppercase tracking-wide">Match</span>
                                                </div>
                                                <div className="w-1.5 h-8 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`w-full ${getRelevanceColor(item.relevanceScore)}`}
                                                        style={{ height: `${item.relevanceScore * 100}%`, marginTop: `${(1 - item.relevanceScore) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right: Active Query Preview (1 col wide) */}
                    <div className="flex flex-col gap-6">
                        <div className="bg-gray-900 text-white rounded-xl shadow-lg p-6 flex-1 flex flex-col">
                            <div className="flex items-center gap-2 mb-6">
                                <Sparkles className="w-5 h-5 text-yellow-400" />
                                <h2 className="font-semibold text-lg">Your Final Query</h2>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-4">
                                <div>
                                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Original Keywords</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {originalKeywords.length > 0 ? originalKeywords.map((k, i) => (
                                            <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 text-gray-300 text-sm">
                                                {k}
                                            </span>
                                        )) : (
                                            <span className="text-gray-500 text-sm italic">None added</span>
                                        )}
                                    </div>
                                </div>

                                {selectedIds.size > 0 && (
                                    <div className="pt-4 border-t border-gray-800">
                                        <h3 className="text-xs font-medium text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                            <Plus className="w-3 h-3" /> Added Suggestions
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {[...selectedIds].map(id => {
                                                const kw = MOCK_SUGGESTIONS.find(s => s.id === id)?.keyword;
                                                return (
                                                    <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-900/30 border border-blue-500/50 text-blue-200 text-sm animate-in fade-in zoom-in duration-200">
                                                        {kw}
                                                        <button onClick={(e) => { e.stopPropagation(); toggleSelection(id); }} className="hover:text-white">
                                                            <MinusCircle className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-6 border-t border-gray-800">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-sm text-gray-400">Total Keywords</span>
                                    <span className="text-2xl font-bold">{finalKeywords.length}</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                setRefinedKeywords(finalKeywords);
                                navigate('/literature');
                            }}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group"
                        >
                            Proceed to Literature Search
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default KeywordRefinementScreen;
