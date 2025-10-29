import { Query } from 'mongoose';
import fetch from 'node-fetch'
export const searchPubMed = async (req, res) => {
    try {
        const { term, maxResults = 10 } = req.body;
        if (!term || term.trim() == " ") {
            return res.status(400).json({
                error: "Search term is required"
            });
        }


        const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
        const url = `${baseUrl}?db=pubmed&term=${encodeURIComponent(term)}&retmode=json&retmax=${maxResults}`;

        const response = await fetch(url);
        const data = await response.json();
        res.status(200).json({
            query: term,
            count: data.esearchresult.count,
            ids: data.esearchresult.idlist,
        });
    } catch (error) {
        console.error("❌ ESearch error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
} 