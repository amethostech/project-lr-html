import { createContext, useState, useContext } from 'react';

const SearchContext = createContext();

export function SearchProvider({ children }) {
    const [searchParams, setSearchParams] = useState({
        keywords: [],
        dateRange: { start: '', end: '' },
        databases: { USPTO: true, PubMed: true, ClinicalTrials: true }
    });

    const [selectedPatents, setSelectedPatents] = useState(new Set());
    const [refinedKeywords, setRefinedKeywords] = useState([]);

    // Future state for literature
    const [selectedPapers, setSelectedPapers] = useState(new Set());

    const value = {
        searchParams,
        setSearchParams,
        selectedPatents,
        setSelectedPatents,
        refinedKeywords,
        setRefinedKeywords,
        selectedPapers,
        setSelectedPapers
    };

    return (
        <SearchContext.Provider value={value}>
            {children}
        </SearchContext.Provider>
    );
}

export function useSearch() {
    return useContext(SearchContext);
}
