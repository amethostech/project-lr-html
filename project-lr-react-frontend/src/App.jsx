import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SearchProvider } from './context/SearchContext';
import InitialSearchSetup from './components/InitialSearchSetup';
import PatentResultsWithKeywords from './components/PatentResultsWithKeywords';
import PubMedSearchScreen from './components/PubMedSearchScreen';
import PubMedResultsWithKeywords from './components/PubMedResultsWithKeywords';
import ClinicalSearchScreen from './components/ClinicalSearchScreen';
import FinalResultsPage from './components/FinalResultsPage';
import ComingSoonPage from './components/ComingSoonPage';

function App() {
  return (
    <SearchProvider>
      <Router>
        <Routes>
          <Route path="/" element={<InitialSearchSetup />} />
          <Route path="/patent-results" element={<PatentResultsWithKeywords />} />
          <Route path="/pubmed-search" element={<PubMedSearchScreen />} />
          <Route path="/pubmed-results" element={<PubMedResultsWithKeywords />} />
          <Route path="/clinical-search" element={<ClinicalSearchScreen />} />
          <Route path="/final-results" element={<FinalResultsPage />} />
          <Route path="/analysis" element={<ComingSoonPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SearchProvider>
  );
}

export default App;
