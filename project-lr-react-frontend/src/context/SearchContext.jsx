import { createContext, useState, useContext } from 'react';

const SearchContext = createContext();

export function SearchProvider({ children }) {
    const [searchParams, setSearchParams] = useState({
        keywords: [],
        dateRange: { start: '', end: '' },
        operator: 'OR'
    });

    const [patentResults, setPatentResults] = useState([]);
    const [selectedPatents, setSelectedPatents] = useState(new Set());
    const [patentExtractedKeywords, setPatentExtractedKeywords] = useState([]);
    const [selectedPatentKeywords, setSelectedPatentKeywords] = useState(new Set());

    const [pubmedResults, setPubmedResults] = useState([]);
    const [selectedPapers, setSelectedPapers] = useState(new Set());
    const [pubmedExtractedKeywords, setPubmedExtractedKeywords] = useState([]);
    const [selectedPubmedKeywords, setSelectedPubmedKeywords] = useState(new Set());

    const [clinicalResults, setClinicalResults] = useState([]);

    const [userAddedKeywords, setUserAddedKeywords] = useState([]);

    const [keywordsPerDatabase, setKeywordsPerDatabase] = useState({
        USPTO: [],
        PubMed: [],
        ClinicalTrials: []
    });

    const value = {
        searchParams, setSearchParams,
        patentResults, setPatentResults,
        selectedPatents, setSelectedPatents,
        patentExtractedKeywords, setPatentExtractedKeywords,
        selectedPatentKeywords, setSelectedPatentKeywords,
        pubmedResults, setPubmedResults,
        selectedPapers, setSelectedPapers,
        pubmedExtractedKeywords, setPubmedExtractedKeywords,
        selectedPubmedKeywords, setSelectedPubmedKeywords,
        clinicalResults, setClinicalResults,
        userAddedKeywords, setUserAddedKeywords,
        keywordsPerDatabase, setKeywordsPerDatabase
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
