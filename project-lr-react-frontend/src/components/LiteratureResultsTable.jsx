import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, FileText, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';

function LiteratureResultsTable() {
    const navigate = useNavigate();
    const { literatureResults, setSelectedPapers: setSelectedContextPapers } = useSearch();

    const [selectedPapers, setSelectedPapers] = useState(new Set());
    const [expandedAbstracts, setExpandedAbstracts] = useState(new Set());

    // Use literatureResults from context, ensure it's an array
    const displayPapers = Array.isArray(literatureResults) ? literatureResults : [];

    // Handle Select All
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedPapers(new Set(displayPapers.map(p => p.id || p.pmid)));
        } else {
            setSelectedPapers(new Set());
        }
    };

    // Handle Single Row Selection
    const handleSelectRow = (paperId) => {
        const newSelected = new Set(selectedPapers);
        if (newSelected.has(paperId)) {
            newSelected.delete(paperId);
        } else {
            newSelected.add(paperId);
        }
        setSelectedPapers(newSelected);
    };

    // Toggle Abstract View
    const toggleAbstract = (paperId) => {
        const newExpanded = new Set(expandedAbstracts);
        if (newExpanded.has(paperId)) {
            newExpanded.delete(paperId);
        } else {
            newExpanded.add(paperId);
        }
        setExpandedAbstracts(newExpanded);
    };

    const selectedCount = selectedPapers.size;
    const isAllSelected = displayPapers.length > 0 && selectedCount === displayPapers.length;

    return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
            <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col">

                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="w-5 h-5 text-teal-600" />
                            <h1 className="text-2xl font-bold text-gray-900">Literature Search Results</h1>
                        </div>
                        <p className="text-gray-500 text-sm">
                            Found {MOCK_PAPERS.length} relevant papers from PubMed. Select papers to extract refined keywords.
                        </p>
                    </div>
                    <div className="bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm text-gray-600 flex items-center gap-2">
                        Current Source: <span className="font-semibold text-teal-700">PubMed</span>
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 border-b border-gray-200 w-12">
                                        <div className="flex items-center justify-center">
                                            <input
                                                type="checkbox"
                                                checked={isAllSelected}
                                                onChange={handleSelectAll}
                                                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-600 focus:ring-offset-0 cursor-pointer"
                                            />
                                        </div>
                                    </th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">PMID</th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/3">Title</th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">Authors</th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">Journal</th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Year</th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">Abstract</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {displayPapers.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-gray-500">
                                            No results found. Try selecting PubMed or Clinical Trials databases and searching again.
                                        </td>
                                    </tr>
                                ) : (
                                    displayPapers.map((paper) => {
                                        // Handle both PubMed and Clinical Trials field names
                                        const paperId = paper.id || paper.pmid || paper.nctId || '';
                                        const title = paper.title || paper.briefTitle || 'No Title';
                                        const authors = paper.authors || paper.sponsor || '';
                                        const source = paper.source || 'Unknown';
                                        const year = paper.year || (paper.date ? paper.date.substring(0, 4) : '');
                                        const abstract = paper.abstract || paper.status || 'No abstract available';

                                        const isSelected = selectedPapers.has(paperId);
                                        const isExpanded = expandedAbstracts.has(paperId);

                                        return (
                                            <tr
                                                key={paperId}
                                                className={`group transition-colors ${isSelected ? 'bg-teal-50/50' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="p-4 align-top">
                                                    <div className="flex items-center justify-center pt-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleSelectRow(paperId)}
                                                            className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-600 focus:ring-offset-0 cursor-pointer"
                                                        />
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top">
                                                    <span className="font-mono text-sm font-medium text-teal-700 bg-teal-50 px-2 py-1 rounded">
                                                        {paperId}
                                                    </span>
                                                </td>
                                                <td className="p-4 align-top">
                                                    <div className="font-semibold text-gray-900 text-sm mb-1 leading-snug">{title}</div>
                                                </td>
                                                <td className="p-4 align-top text-sm text-gray-600">
                                                    {authors}
                                                </td>
                                                <td className="p-4 align-top text-sm text-gray-700 italic">
                                                    {source}
                                                </td>
                                                <td className="p-4 align-top text-sm text-gray-600 font-medium">
                                                    {year}
                                                </td>
                                                <td className="p-4 align-top text-sm text-gray-600">
                                                    <div className={`relative ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                                        {abstract}
                                                    </div>
                                                    <button
                                                        onClick={() => toggleAbstract(paperId)}
                                                        className="text-xs font-medium text-teal-600 hover:text-teal-800 mt-1 flex items-center gap-1 focus:outline-none"
                                                    >
                                                        {isExpanded ? (
                                                            <>Show Less <ChevronUp className="w-3 h-3" /></>
                                                        ) : (
                                                            <>View More <ChevronDown className="w-3 h-3" /></>
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Action Bar */}
                    <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0 z-20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-600 pl-2">
                            <div className={`w-2 h-2 rounded-full ${selectedCount > 0 ? 'bg-teal-500' : 'bg-gray-300'}`}></div>
                            <span className="font-medium text-gray-900">{selectedCount}</span> papers selected
                        </div>

                        <button
                            onClick={() => {
                                setSelectedContextPapers(selectedPapers);
                                navigate('/report');
                            }}
                            disabled={selectedCount === 0}
                            className="px-6 py-3 bg-teal-800 hover:bg-teal-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            Generate Final Report
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LiteratureResultsTable;
