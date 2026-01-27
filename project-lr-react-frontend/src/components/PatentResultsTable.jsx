import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, ArrowRight, FileText } from 'lucide-react';

// Mock Data Generation
const MOCK_PATENTS = [
    {
        patentId: "US11564998B2",
        title: "Methods for treating schizophrenia using xanomeline",
        inventors: ["Steve Paul", "Alan Breier"],
        assignee: "Karuna Therapeutics, Inc.",
        year: "2023",
        abstract: "The present invention provides methods for treating schizophrenia and related disorders comprising administering to a patient in need thereof a pharmaceutical composition comprising xanomeline and trospium chloride. The combination provides efficacy while minimizing side effects associated with muscarinic agonists."
    },
    {
        patentId: "US11285145B2",
        title: "Muscarinic receptor agonists and uses thereof",
        inventors: ["Andrew C. Miller", "Christian Felder"],
        assignee: "PureTech Health",
        year: "2022",
        abstract: "Disclosed are novel muscarinic receptor agonists useful for the treatment of neurological and psychiatric disorders. The compounds demonstrate high selectivity for M1 and M4 receptors."
    },
    {
        patentId: "US10980789B2",
        title: "Deuterated analogs of xanomeline",
        inventors: ["Julie M. Prazich"],
        assignee: "Karuna Therapeutics, Inc.",
        year: "2021",
        abstract: "The present disclosure relates to deuterated forms of xanomeline, pharmaceutical compositions thereof, and methods of using the same for treating various central nervous system disorders."
    },
    {
        patentId: "US10543201B2",
        title: "Compositions for transdermal delivery of antipsychotics",
        inventors: ["Robert Langer", "Giovanni Traverso"],
        assignee: "MIT",
        year: "2020",
        abstract: "A transdermal delivery system for the sustained release of antipsychotic medications, comprising a microneedle array patch that facilitates improved patient compliance and steady plasma concentrations."
    },
    {
        patentId: "US9877954B2",
        title: "Combination therapies for treating psychosis",
        inventors: ["David S. Albeck"],
        assignee: "Acadia Pharmaceuticals",
        year: "2018",
        abstract: "Methods are provided for treating psychosis associated with neurodegenerative diseases, comprising calculating a specific dosage regimen of pimavanserin in combination with other therapeutic agents to optimize clinical outcomes."
    }
];

function PatentResultsTable({ onExtractKeywords }) {
    const [selectedPatents, setSelectedPatents] = useState(new Set());
    const [expandedAbstracts, setExpandedAbstracts] = useState(new Set());

    // Handle Select All
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedPatents(new Set(MOCK_PATENTS.map(p => p.patentId)));
        } else {
            setSelectedPatents(new Set());
        }
    };

    // Handle Single Row Selection
    const handleSelectRow = (patentId) => {
        const newSelected = new Set(selectedPatents);
        if (newSelected.has(patentId)) {
            newSelected.delete(patentId);
        } else {
            newSelected.add(patentId);
        }
        setSelectedPatents(newSelected);
    };

    // Toggle Abstract View
    const toggleAbstract = (patentId) => {
        const newExpanded = new Set(expandedAbstracts);
        if (newExpanded.has(patentId)) {
            newExpanded.delete(patentId);
        } else {
            newExpanded.add(patentId);
        }
        setExpandedAbstracts(newExpanded);
    };

    const selectedCount = selectedPatents.size;
    const isAllSelected = MOCK_PATENTS.length > 0 && selectedCount === MOCK_PATENTS.length;

    return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col">
            <div className="flex-1 max-w-7xl mx-auto w-full flex flex-col">

                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Search Results</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Found {MOCK_PATENTS.length} relevant patents. Select patents to extract keywords.
                        </p>
                    </div>
                    <div className="bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-sm text-gray-600">
                        Current Source: <span className="font-semibold text-gray-900">USPTO</span>
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
                                                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 focus:ring-offset-0 cursor-pointer"
                                            />
                                        </div>
                                    </th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Patent ID</th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider w-1/4">Title</th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">Assignee</th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Year</th>
                                    <th className="p-4 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">Abstract</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {MOCK_PATENTS.map((patent) => {
                                    const isSelected = selectedPatents.has(patent.patentId);
                                    const isExpanded = expandedAbstracts.has(patent.patentId);

                                    return (
                                        <tr
                                            key={patent.patentId}
                                            className={`group transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                                        >
                                            <td className="p-4 align-top">
                                                <div className="flex items-center justify-center pt-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectRow(patent.patentId)}
                                                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 focus:ring-offset-0 cursor-pointer"
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-4 align-top">
                                                <span className="font-mono text-sm font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                                    {patent.patentId}
                                                </span>
                                            </td>
                                            <td className="p-4 align-top">
                                                <div className="font-semibold text-gray-900 text-sm mb-1">{patent.title}</div>
                                                <div className="text-xs text-gray-500">
                                                    {Array.isArray(patent.inventors) ? patent.inventors.join(", ") : patent.inventors}
                                                </div>
                                            </td>
                                            <td className="p-4 align-top text-sm text-gray-700">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                                                        {patent.assignee.charAt(0)}
                                                    </div>
                                                    {patent.assignee}
                                                </div>
                                            </td>
                                            <td className="p-4 align-top text-sm text-gray-600 font-medium">
                                                {patent.year}
                                            </td>
                                            <td className="p-4 align-top text-sm text-gray-600">
                                                <div className={`relative ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                                    {patent.abstract}
                                                </div>
                                                <button
                                                    onClick={() => toggleAbstract(patent.patentId)}
                                                    className="text-xs font-medium text-gray-500 hover:text-gray-900 mt-1 flex items-center gap-1 focus:outline-none"
                                                >
                                                    {isExpanded ? (
                                                        <>Show Less <ChevronUp className="w-3 h-3" /></>
                                                    ) : (
                                                        <>Read More <ChevronDown className="w-3 h-3" /></>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer Action Bar */}
                    <div className="bg-white border-t border-gray-200 p-4 sticky bottom-0 z-20 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-600 pl-2">
                            <div className={`w-2 h-2 rounded-full ${selectedCount > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                            <span className="font-medium text-gray-900">{selectedCount}</span> patents selected
                        </div>

                        <button
                            onClick={() => onExtractKeywords && onExtractKeywords(Array.from(selectedPatents))}
                            disabled={selectedCount === 0}
                            className="px-6 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2"
                        >
                            <FileText className="w-4 h-4" />
                            Extract Keywords from Selection
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PatentResultsTable;
