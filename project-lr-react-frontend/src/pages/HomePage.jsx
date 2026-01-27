import InitialSearchSetup from '../components/InitialSearchSetup';
import SearchExecutionScreen from '../components/SearchExecutionScreen';
import PatentResultsTable from '../components/PatentResultsTable';
import { useState } from 'react';
function HomePage() {
    const [currentScreen, setCurrentScreen] = useState('setup'); // setup, execution, results
    const [searchParams, setSearchParams] = useState(null);

    const handleStartSearch = (params) => {
        setSearchParams(params);
        setCurrentScreen('execution');
    };

    const handleSearchComplete = () => {
        console.log('Search completed! Moving to results...');
        setCurrentScreen('results');
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
                        // Future: Navigate to Keyword Extraction Screen
                    }}
                />
            )}
        </main>
    );
}

export default HomePage;
