
import InitialSearchSetup from '../components/InitialSearchSetup';
import SearchExecutionScreen from '../components/SearchExecutionScreen';
import PatentResultsTable from '../components/PatentResultsTable';
import KeywordRefinementScreen from '../components/KeywordRefinementScreen';
import { useState } from 'react';

function HomePage() {
    const [currentScreen, setCurrentScreen] = useState('setup'); // setup, execution, results, refinement
    const [searchParams, setSearchParams] = useState(null);

    const handleStartSearch = (params) => {
        setSearchParams(params);
        setCurrentScreen('execution');
    };

    const handleSearchComplete = () => {
        console.log('Search completed! Moving to results...');
        setCurrentScreen('results');
    };

    const handleRefinementProceed = (finalKeywords) => {
        console.log('Final Keywords for Literature Search:', finalKeywords);
        // Future: Navigate to Literature Search Results
    };

    return (
        <main>
            {currentScreen === 'setup' && (
                <InitialSearchSetup onSearch={handleStartSearch} />
            )}

            {currentScreen === 'execution' && (
                <SearchExecutionScreen
                    searchParams={searchParams}
                    onComplete={handleSearchComplete}
                />
            )}

            {currentScreen === 'results' && (
                <PatentResultsTable
                    onExtractKeywords={(selectedIds) => {
                        console.log('Extracting keywords for:', selectedIds);
                        // Simulate extraction logic - move to refinement
                        setCurrentScreen('refinement');
                    }}
                />
            )}

            {currentScreen === 'refinement' && (
                <KeywordRefinementScreen
                    originalKeywords={searchParams?.keywords || []}
                    onProceed={handleRefinementProceed}
                />
            )}
        </main>
    );
}

export default HomePage;
