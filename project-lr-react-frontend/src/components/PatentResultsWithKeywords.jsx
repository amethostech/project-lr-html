import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { ChevronDown, ChevronUp, FileText, Plus, X, Loader2, ArrowRight, Check } from 'lucide-react';

const safeString = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val['#text']) return String(val['#text']);
        if (Array.isArray(val)) return val.map(v => safeString(v)).join(', ');
        return JSON.stringify(val);
    }
    return String(val);
};

function PatentResultsWithKeywords() {
    const navigate = useNavigate();
    const {
        patentResults,
        selectedPatents, setSelectedPatents,
        patentExtractedKeywords, setPatentExtractedKeywords,
        selectedPatentKeywords, setSelectedPatentKeywords,
        userAddedKeywords, setUserAddedKeywords,
        searchParams
    } = useSearch();

    const [expandedAbstracts, setExpandedAbstracts] = useState(new Set());
    const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');

    useEffect(() => {
        if (patentResults.length > 0 && patentExtractedKeywords.length === 0) {
            extractKeywords();
        }
    }, [patentResults]);

    const extractKeywords = async () => {
        setIsExtractingKeywords(true);
        try {
            const PYTHON_BACKEND = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:8000';
            const response = await fetch(`${PYTHON_BACKEND}/api/extract-keywords`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: patentResults,
                    source: 'USPTO'
                })
            });
            if (response.ok) {
                const data = await response.json();
                setPatentExtractedKeywords(data.keywords || []);
            }
        } catch (error) {
            console.error('Keyword extraction failed:', error);
        } finally {
            setIsExtractingKeywords(false);
        }
    };

    const togglePatentSelect = (id) => {
        const newSet = new Set(selectedPatents);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPatents(newSet);
    };

    const toggleKeywordSelect = (keyword) => {
        const newSet = new Set(selectedPatentKeywords);
        if (newSet.has(keyword)) newSet.delete(keyword);
        else newSet.add(keyword);
        setSelectedPatentKeywords(newSet);
    };

    const toggleAbstract = (id) => {
        const newSet = new Set(expandedAbstracts);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedAbstracts(newSet);
    };

    const handleAddKeyword = () => {
        const trimmed = newKeyword.trim();
        if (trimmed && !userAddedKeywords.includes(trimmed)) {
            setUserAddedKeywords([...userAddedKeywords, trimmed]);
            setNewKeyword('');
        }
    };

    const handleRemoveUserKeyword = (keyword) => {
        setUserAddedKeywords(userAddedKeywords.filter(k => k !== keyword));
    };

    const handleProceed = () => {
        navigate('/pubmed-search');
    };

    const patents = Array.isArray(patentResults) ? patentResults : [];
    const totalSelectedKeywords = selectedPatentKeywords.size + userAddedKeywords.length;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-gray-700" />
                        USPTO Patent Results
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Keywords: "{searchParams?.keywords?.join(', ') || 'N/A'}" |
                        Found {patents.length} patents
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <div className="bg-white border border-gray-300 rounded-lg shadow-sm overflow-hidden">
                            <div className="p-4 bg-gray-100 border-b border-gray-300 flex items-center justify-between">
                                <span className="font-semibold text-gray-900">
                                    Patents ({patents.length})
                                </span>
                                <span className="text-sm text-gray-500">
                                    {selectedPatents.size} selected
                                </span>
                            </div>
                            <div className="overflow-auto max-h-[600px]">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 w-12"></th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">ID</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Title</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Year</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Abstract</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {patents.map((patent) => {
                                            const id = patent.patent_id || patent.id || '';
                                            const isSelected = selectedPatents.has(id);
                                            const isExpanded = expandedAbstracts.has(id);
                                            return (
                                                <tr key={id} className={`${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'} transition-colors`}>
                                                    <td className="p-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => togglePatentSelect(id)}
                                                            className="w-4 h-4 rounded border-gray-400 text-gray-900"
                                                        />
                                                    </td>
                                                    <td className="p-3 font-mono text-sm text-gray-700">{safeString(id)}</td>
                                                    <td className="p-3 text-sm font-medium text-gray-900">{safeString(patent.title || patent.patent_title) || 'No Title'}</td>
                                                    <td className="p-3 text-sm text-gray-600">{safeString(patent.year || patent.patent_date?.substring(0, 4)) || 'N/A'}</td>
                                                    <td className="p-3 text-sm text-gray-600">
                                                        <div className={`${!isExpanded ? 'line-clamp-2' : ''}`}>
                                                            {safeString(patent.abstract || patent.patent_abstract) || 'No abstract'}
                                                        </div>
                                                        {(patent.abstract || patent.patent_abstract) && (
                                                            <button
                                                                onClick={() => toggleAbstract(id)}
                                                                className="text-xs text-gray-500 hover:text-gray-900 mt-1 underline flex items-center gap-1"
                                                            >
                                                                {isExpanded ? <>Less <ChevronUp className="w-3 h-3" /></> : <>More <ChevronDown className="w-3 h-3" /></>}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
                            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                Extracted Keywords
                                {isExtractingKeywords && <Loader2 className="w-4 h-4 animate-spin" />}
                            </h3>
                            {patentExtractedKeywords.length > 0 ? (
                                <div className="space-y-2">
                                    {patentExtractedKeywords.map((keyword, idx) => (
                                        <label key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                                            <input
                                                type="checkbox"
                                                checked={selectedPatentKeywords.has(keyword)}
                                                onChange={() => toggleKeywordSelect(keyword)}
                                                className="w-4 h-4 rounded border-gray-400 text-gray-900"
                                            />
                                            <span className="text-sm text-gray-700">{keyword}</span>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400">
                                    {isExtractingKeywords ? 'Extracting...' : 'No keywords extracted'}
                                </p>
                            )}
                        </div>

                        <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-4">
                            <h3 className="font-semibold text-gray-900 mb-3">Add Custom Keywords</h3>
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    value={newKeyword}
                                    onChange={(e) => setNewKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                                    placeholder="Add keyword..."
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                                />
                                <button
                                    onClick={handleAddKeyword}
                                    className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            {userAddedKeywords.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {userAddedKeywords.map((keyword, idx) => (
                                        <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                                            {keyword}
                                            <button onClick={() => handleRemoveUserKeyword(keyword)} className="text-gray-400 hover:text-red-600">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleProceed}
                            disabled={totalSelectedKeywords === 0 && selectedPatents.size === 0}
                            className="w-full py-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            Continue to PubMed Search
                            <ArrowRight className="w-5 h-5" />
                        </button>
                        <p className="text-center text-gray-400 text-xs">
                            {selectedPatents.size} patents, {totalSelectedKeywords} keywords selected
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PatentResultsWithKeywords;
