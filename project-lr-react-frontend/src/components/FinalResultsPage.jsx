import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';
import { ChevronDown, ChevronUp, ChevronRight, FileText, BookOpen, Activity, Database, Sparkles } from 'lucide-react';

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

function FinalResultsPage() {
    const navigate = useNavigate();
    const {
        patentResults,
        pubmedResults,
        clinicalResults,
        keywordsPerDatabase,
        selectedPatents,
        selectedPapers
    } = useSearch();

    const [collapsedSections, setCollapsedSections] = useState({
        patents: false,
        pubmed: false,
        clinical: false
    });

    const toggleSection = (section) => {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const patents = Array.isArray(patentResults) ? patentResults : [];
    const papers = Array.isArray(pubmedResults) ? pubmedResults : [];
    const trials = Array.isArray(clinicalResults) ? clinicalResults : [];

    const SectionHeader = ({ title, icon: Icon, count, section, keywords = [] }) => (
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
            </div>
            <div className="flex items-center gap-2">
                {keywords.length > 0 && (
                    <span className="text-xs text-gray-500">
                        Keywords: {keywords.slice(0, 3).join(', ')}{keywords.length > 3 ? '...' : ''}
                    </span>
                )}
            </div>
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Database className="w-6 h-6 text-gray-700" />
                        Final Search Results
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Complete results from all database searches
                    </p>
                </div>

                {patents.length > 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg shadow-sm mb-4 overflow-hidden">
                        <SectionHeader
                            title="USPTO Patents"
                            icon={FileText}
                            count={patents.length}
                            section="patents"
                            keywords={keywordsPerDatabase?.USPTO || []}
                        />
                        {!collapsedSections.patents && (
                            <div className="overflow-auto max-h-[400px]">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">ID</th>
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
                                                <tr key={id} className={`${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                                                    <td className="p-3 font-mono text-sm text-gray-700">{safeString(id)}</td>
                                                    <td className="p-3 text-sm text-gray-900">{safeString(patent.title || patent.patent_title) || 'No Title'}</td>
                                                    <td className="p-3 text-sm text-gray-600">{safeString(patent.assignee) || 'Unknown'}</td>
                                                    <td className="p-3 text-sm text-gray-600">{safeString(patent.year || patent.patent_date?.substring(0, 4)) || 'N/A'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {papers.length > 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg shadow-sm mb-4 overflow-hidden">
                        <SectionHeader
                            title="PubMed Articles"
                            icon={BookOpen}
                            count={papers.length}
                            section="pubmed"
                            keywords={keywordsPerDatabase?.PubMed || []}
                        />
                        {!collapsedSections.pubmed && (
                            <div className="overflow-auto max-h-[400px]">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">PMID</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Title</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Authors</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Year</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {papers.map((paper) => {
                                            const id = paper.id || paper.pmid || '';
                                            const isSelected = selectedPapers.has(id);
                                            return (
                                                <tr key={id} className={`${isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                                                    <td className="p-3 font-mono text-sm text-gray-700">{safeString(id)}</td>
                                                    <td className="p-3 text-sm text-gray-900">{safeString(paper.title) || 'No Title'}</td>
                                                    <td className="p-3 text-sm text-gray-600">{safeString(paper.authors) || 'Unknown'}</td>
                                                    <td className="p-3 text-sm text-gray-600">{safeString(paper.year) || 'N/A'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {trials.length > 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg shadow-sm mb-4 overflow-hidden">
                        <SectionHeader
                            title="Clinical Trials"
                            icon={Activity}
                            count={trials.length}
                            section="clinical"
                            keywords={keywordsPerDatabase?.ClinicalTrials || []}
                        />
                        {!collapsedSections.clinical && (
                            <div className="overflow-auto max-h-[400px]">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">NCT ID</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Title</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Sponsor</th>
                                            <th className="p-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {trials.map((trial) => {
                                            const id = trial.id || trial.nctId || '';
                                            return (
                                                <tr key={id} className="hover:bg-gray-50">
                                                    <td className="p-3 font-mono text-sm text-gray-700">
                                                        <a href={trial.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                            {safeString(id)}
                                                        </a>
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-900">{safeString(trial.title) || 'No Title'}</td>
                                                    <td className="p-3 text-sm text-gray-600">{safeString(trial.sponsor) || 'Unknown'}</td>
                                                    <td className="p-3">
                                                        <span className="text-xs px-2 py-1 rounded-full border bg-gray-50 border-gray-300 text-gray-600">
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

                {patents.length === 0 && papers.length === 0 && trials.length === 0 && (
                    <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-12 text-center">
                        <Database className="w-12 h-12 mx-auto text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-600">No Results Found</h3>
                        <p className="text-gray-400 mt-2">Try a new search with different keywords</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
                        >
                            New Search
                        </button>
                    </div>
                )}

                <div className="mt-8 flex justify-center">
                    <button
                        onClick={() => navigate('/analysis')}
                        className="px-8 py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all flex items-center gap-3"
                    >
                        <Sparkles className="w-5 h-5" />
                        Would you like further analysis?
                    </button>
                </div>
            </div>
        </div>
    );
}

export default FinalResultsPage;
