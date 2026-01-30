import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, BookOpen, Activity, Check, Database, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';

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

function UnifiedResultsPage() {
    const navigate = useNavigate();
    const {
        searchParams,
        patentResults,
        literatureResults,
        setSelectedPatents: setContextSelectedPatents,
        setSelectedPapers: setContextSelectedPapers
    } = useSearch();

    // Selection state
    const [selectedPatents, setSelectedPatents] = useState(new Set());
    const [selectedPapers, setSelectedPapers] = useState(new Set());
    const [expandedAbstracts, setExpandedAbstracts] = useState(new Set());

    // Collapsed sections - start collapsed by default
    const [collapsedSections, setCollapsedSections] = useState({
        patents: true,
        pubmed: true,
        clinical: true
    });

    // Ensure arrays
    const patents = Array.isArray(patentResults) ? patentResults : [];
    const literature = Array.isArray(literatureResults) ? literatureResults : [];

    // Separate PubMed and Clinical Trials from literature results
    const pubmedResults = literature.filter(item => item.source === 'PubMed');
    const clinicalResults = literature.filter(item => item.source === 'ClinicalTrials.gov');

    // Toggle functions
    const toggleSection = (section) => {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const togglePatentSelect = (id) => {
        const newSet = new Set(selectedPatents);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPatents(newSet);
    };

    const togglePaperSelect = (id) => {
        const newSet = new Set(selectedPapers);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPapers(newSet);
    };

    const toggleAbstract = (id) => {
        const newSet = new Set(expandedAbstracts);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedAbstracts(newSet);
    };

    const handleProceed = () => {
        setContextSelectedPatents(selectedPatents);
        setContextSelectedPapers(selectedPapers);
        navigate('/refinement');
    };

    const totalSelected = selectedPatents.size + selectedPapers.size;

    // Section Header Component - Professional gray theme
    const SectionHeader = ({ title, icon: Icon, count, section, selectedCount = 0 }) => (
        <button
            onClick={() => toggleSection(section)}
            className="w-full flex items-center justify-between p-4 bg-gray-100 hover:bg-gray-200 border-b border-gray-300 transition-all"
        >
            <div className="flex items-center gap-3">
                <div className={`transition-transform duration-200 ${collapsedSections[section] ? '' : 'rotate-90'}`}>
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
                <Icon className="w-5 h-5 text-gray-700" />
                <span className="font-semibold text-gray-900">{title}</span>
                <span className="text-sm text-gray-500">({count} results)</span>
                {selectedCount > 0 && (
                    <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">
                        {selectedCount} selected
                    </span>
                )}
            </div>
            <span className="text-xs text-gray-500">
                {collapsedSections[section] ? 'Click to expand' : 'Click to collapse'}
            </span>
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Database className="w-6 h-6 text-gray-700" />
                            Search Results
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Keywords: "{searchParams?.keywords?.join(', ') || 'N/A'}" |
                            Date: {searchParams?.dateRange?.start || 'All'} - {searchParams?.dateRange?.end || 'Present'}
                        </p>
                    </div>
                    <button
                        onClick={handleProceed}
                        disabled={totalSelected === 0}
                        className="px-6 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2"
                    >
                        <Check className="w-4 h-4" />
                        Proceed with {totalSelected} Selected
                    </button>
                </div>

                {/* USPTO Patents Section */}
                {searchParams?.databases?.USPTO && patents.length > 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg shadow-sm mb-4 overflow-hidden">
                        <SectionHeader
                            title="USPTO Patents"
                            icon={FileText}
                            count={patents.length}
                            section="patents"
                            selectedCount={selectedPatents.size}
                        />
                        {!collapsedSections.patents && (
                            <div className="overflow-auto max-h-[500px]">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 w-12"></th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Patent ID</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Title</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Assignee</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Year</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {patents.map((patent) => {
                                            const id = patent.patent_id || patent.id || '';
                                            const isSelected = selectedPatents.has(id);
                                            return (
                                                <tr key={id} className={`${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'} transition-colors`}>
                                                    <td className="p-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => togglePatentSelect(id)}
                                                            className="w-4 h-4 rounded border-gray-400 text-gray-900 focus:ring-gray-500"
                                                        />
                                                    </td>
                                                    <td className="p-3 font-mono text-sm text-gray-700">{id}</td>
                                                    <td className="p-3 text-sm font-medium text-gray-900">{safeString(patent.title) || 'No Title'}</td>
                                                    <td className="p-3 text-sm text-gray-600">{safeString(patent.assignee) || 'Unknown'}</td>
                                                    <td className="p-3 text-sm text-gray-600">{safeString(patent.year) || 'N/A'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* PubMed Section */}
                {searchParams?.databases?.PubMed && pubmedResults.length > 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg shadow-sm mb-4 overflow-hidden">
                        <SectionHeader
                            title="PubMed Articles"
                            icon={BookOpen}
                            count={pubmedResults.length}
                            section="pubmed"
                            selectedCount={Array.from(selectedPapers).filter(id => pubmedResults.some(p => (p.id || p.pmid) === id)).length}
                        />
                        {!collapsedSections.pubmed && (
                            <div className="overflow-auto max-h-[500px]">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 w-12"></th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">PMID</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase w-1/3">Title</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Authors</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Year</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Abstract</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {pubmedResults.map((paper) => {
                                            const id = paper.id || paper.pmid || '';
                                            const isSelected = selectedPapers.has(id);
                                            const isExpanded = expandedAbstracts.has(id);
                                            return (
                                                <tr key={id} className={`${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'} transition-colors`}>
                                                    <td className="p-3 align-top">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => togglePaperSelect(id)}
                                                            className="w-4 h-4 rounded border-gray-400 text-gray-900 focus:ring-gray-500"
                                                        />
                                                    </td>
                                                    <td className="p-3 align-top font-mono text-sm text-gray-700">{safeString(id)}</td>
                                                    <td className="p-3 align-top text-sm font-medium text-gray-900">{safeString(paper.title) || 'No Title'}</td>
                                                    <td className="p-3 align-top text-sm text-gray-600">{safeString(paper.authors) || 'Unknown'}</td>
                                                    <td className="p-3 align-top text-sm text-gray-600">{safeString(paper.year) || 'N/A'}</td>
                                                    <td className="p-3 align-top text-sm text-gray-600">
                                                        <div className={`${!isExpanded ? 'line-clamp-2' : ''}`}>
                                                            {safeString(paper.abstract) || 'No abstract'}
                                                        </div>
                                                        <button
                                                            onClick={() => toggleAbstract(id)}
                                                            className="text-xs text-gray-500 hover:text-gray-900 mt-1 flex items-center gap-1 underline"
                                                        >
                                                            {isExpanded ? <>Less <ChevronUp className="w-3 h-3" /></> : <>More <ChevronDown className="w-3 h-3" /></>}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Clinical Trials Section */}
                {searchParams?.databases?.ClinicalTrials && clinicalResults.length > 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg shadow-sm mb-4 overflow-hidden">
                        <SectionHeader
                            title="Clinical Trials"
                            icon={Activity}
                            count={clinicalResults.length}
                            section="clinical"
                            selectedCount={Array.from(selectedPapers).filter(id => clinicalResults.some(t => (t.id || t.nctId) === id)).length}
                        />
                        {!collapsedSections.clinical && (
                            <div className="overflow-auto max-h-[500px]">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 w-12"></th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">NCT ID</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase w-1/3">Title</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Sponsor</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {clinicalResults.map((trial) => {
                                            const id = trial.id || trial.nctId || '';
                                            const isSelected = selectedPapers.has(id);
                                            return (
                                                <tr key={id} className={`${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'} transition-colors`}>
                                                    <td className="p-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => togglePaperSelect(id)}
                                                            className="w-4 h-4 rounded border-gray-400 text-gray-900 focus:ring-gray-500"
                                                        />
                                                    </td>
                                                    <td className="p-3 font-mono text-sm text-gray-700">
                                                        <a href={trial.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                            {safeString(id)}
                                                        </a>
                                                    </td>
                                                    <td className="p-3 text-sm font-medium text-gray-900">{safeString(trial.title) || 'No Title'}</td>
                                                    <td className="p-3 text-sm text-gray-600">{safeString(trial.sponsor) || 'Unknown'}</td>
                                                    <td className="p-3">
                                                        <span className={`text-xs px-2 py-1 rounded-full border ${trial.status === 'Recruiting' ? 'bg-gray-100 border-gray-400 text-gray-800' :
                                                            trial.status === 'Completed' ? 'bg-gray-200 border-gray-500 text-gray-900' :
                                                                'bg-gray-50 border-gray-300 text-gray-600'
                                                            }`}>
                                                            {safeString(trial.status) || 'Unknown'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* No Results Message */}
                {patents.length === 0 && pubmedResults.length === 0 && clinicalResults.length === 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-12 text-center">
                        <Database className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-600">No Results Found</h3>
                        <p className="text-gray-400 mt-2">Try different keywords or date range</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                        >
                            New Search
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default UnifiedResultsPage;
