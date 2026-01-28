import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SearchProvider } from './context/SearchContext';
import InitialSearchSetup from './components/InitialSearchSetup';
import SearchExecutionScreen from './components/SearchExecutionScreen';
import PatentResultsTable from './components/PatentResultsTable';
import KeywordRefinementScreen from './components/KeywordRefinementScreen';
import LiteratureResultsTable from './components/LiteratureResultsTable';
import FinalReportScreen from './components/FinalReportScreen';

function App() {
  return (
    <SearchProvider>
      <Router>
        <Routes>
          <Route path="/" element={<InitialSearchSetup />} />
          <Route path="/search" element={<SearchExecutionScreen />} />
          <Route path="/patents" element={<PatentResultsTable />} />
          <Route path="/refinement" element={<KeywordRefinementScreen />} />
          <Route path="/literature" element={<LiteratureResultsTable />} />
          <Route path="/report" element={<FinalReportScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </SearchProvider>
  );
}

export default App;
