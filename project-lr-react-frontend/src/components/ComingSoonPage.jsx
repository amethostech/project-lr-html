import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

function ComingSoonPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-xl p-12 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                    <Sparkles className="w-10 h-10 text-gray-600" />
                </div>

                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Coming Soon
                </h1>

                <p className="text-gray-500 text-lg mb-8">
                    Advanced analysis features are currently under development.
                </p>

                <div className="space-y-4 text-left bg-gray-50 rounded-lg p-6 mb-8">
                    <h3 className="font-semibold text-gray-900">Planned Features:</h3>
                    <ul className="space-y-2 text-gray-600">
                        <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                            AI-powered trend analysis
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                            Patent landscape visualization
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                            Citation network graphs
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                            Export to PDF/Excel
                        </li>
                    </ul>
                </div>

                <button
                    onClick={() => navigate('/final-results')}
                    className="px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all flex items-center gap-2 mx-auto"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back to Results
                </button>
            </div>
        </div>
    );
}

export default ComingSoonPage;
