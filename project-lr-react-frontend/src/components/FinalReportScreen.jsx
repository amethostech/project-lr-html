import { Download, FileJson, FileText, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../context/SearchContext';

function FinalReportScreen() {
    const navigate = useNavigate();
    const {
        searchParams,
        selectedPatents,
        refinedKeywords,
        selectedPapers
    } = useSearch();

    // Guard: Redirect if no data
    if (!searchParams) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h2 className="text-xl font-semibold mb-4">No Session Found</h2>
                    <button onClick={() => navigate('/')} className="text-blue-600 hover:underline">Return to Home</button>
                </div>
            </div>
        )
    }

    const handleExport = (format) => {
        const reportData = {
            meta: {
                date: new Date().toISOString(),
                dateRange: searchParams.dateRange
            },
            query: {
                original: searchParams.keywords,
                refined: refinedKeywords
            },
            results: {
                patents: Array.from(selectedPatents),
                literature: Array.from(selectedPapers)
            }
        };

        console.log(`Exporting as ${format}:`, reportData);
        alert(`Report exported as ${format}! Check console for data structure.`);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <button
                            onClick={() => navigate('/literature')}
                            className="flex items-center text-gray-500 hover:text-gray-900 mb-2 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 mr-1" /> Back
                        </button>
                        <h1 className="text-3xl font-bold text-gray-900">Discovery Report</h1>
                        <p className="text-gray-500 mt-1">Summary of your patent and literature analysis session.</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleExport('CSV')}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-all shadow-sm"
                        >
                            <FileText className="w-4 h-4" /> Export CSV
                        </button>
                        <button
                            onClick={() => handleExport('JSON')}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium transition-all shadow-sm"
                        >
                            <FileJson className="w-4 h-4" /> Export JSON
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Left Column: Summary Stats */}
                    <div className="md:col-span-2 space-y-6">

                        {/* 1. Search Criteria Card */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-500" />
                                Search Criteria
                            </h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <span className="block text-gray-500 mb-1">Date Range</span>
                                    <span className="font-medium text-gray-900">
                                        {searchParams.dateRange.start || 'N/A'} - {searchParams.dateRange.end || 'N/A'}
                                    </span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <span className="block text-gray-500 mb-1">Databases</span>
                                    <div className="flex gap-2">
                                        {Object.entries(searchParams.databases)
                                            .filter(([_, active]) => active)
                                            .map(([name]) => (
                                                <span key={name} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-xs font-medium text-gray-600">
                                                    {name}
                                                </span>
                                            ))
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Patent Selection */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Selected Patents</h3>
                                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                                    {selectedPatents.size} Items
                                </span>
                            </div>
                            {selectedPatents.size > 0 ? (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-4 py-2">Patent ID</th>
                                                <th className="px-4 py-2">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {Array.from(selectedPatents).map(id => (
                                                <tr key={id}>
                                                    <td className="px-4 py-2 font-mono text-gray-700">{id}</td>
                                                    <td className="px-4 py-2 text-green-600 flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> Included
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-500 italic">No patents selected.</p>
                            )}
                        </div>

                        {/* 3. Literature Selection */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Selected Literature</h3>
                                <span className="px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-sm font-medium">
                                    {selectedPapers.size} Items
                                </span>
                            </div>
                            {selectedPapers.size > 0 ? (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium">
                                            <tr>
                                                <th className="px-4 py-2">PMID</th>
                                                <th className="px-4 py-2">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {Array.from(selectedPapers).map(id => (
                                                <tr key={id}>
                                                    <td className="px-4 py-2 font-mono text-gray-700">{id}</td>
                                                    <td className="px-4 py-2 text-green-600 flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> Included
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-500 italic">No papers selected.</p>
                            )}
                        </div>

                    </div>

                    {/* Right Column: Keyword Cloud */}
                    <div className="md:col-span-1">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Refined Keyword Set</h3>
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 mb-4">
                                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Final Query Terms</p>
                                <div className="flex flex-wrap gap-2">
                                    {refinedKeywords.length > 0 ? refinedKeywords.map((kw, i) => (
                                        <span key={i} className="inline-flex items-center px-2.5 py-1.5 rounded-md bg-white border border-gray-200 text-gray-700 text-xs font-medium shadow-sm">
                                            {kw}
                                        </span>
                                    )) : (
                                        <span className="text-gray-400 italic text-sm">No refined keywords (using originals)</span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Original Terms</span>
                                    <span className="font-medium">{searchParams.keywords.length}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Added Terms</span>
                                    <span className="font-medium">{Math.max(0, refinedKeywords.length - searchParams.keywords.length)}</span>
                                </div>
                                <div className="pt-3 border-t border-gray-100 flex justify-between text-sm font-semibold">
                                    <span className="text-gray-900">Total Vocabulary</span>
                                    <span className="text-blue-600">{refinedKeywords.length > 0 ? refinedKeywords.length : searchParams.keywords.length}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/')}
                                className="w-full mt-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm"
                            >
                                Start New Search
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default FinalReportScreen;
