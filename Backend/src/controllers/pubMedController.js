import { Query } from 'mongoose';
import fetch from 'node-fetch'

export const searchPubMed = async (req, res) => {
    try {
        const {
          keywords = [],
          dateFrom,
          dateTo,
          maxResults = 100,
        } = req.body || {};

        // Basic validation
        if ((!Array.isArray(keywords) || keywords.length === 0) && !(req.body && req.body.term)) {
            return res.status(400).json({ error: "Search keywords are required" });
        }

        // Build the query term server-side for reliable escaping and boolean placement
        let term = "";
        if (Array.isArray(keywords) && keywords.length > 0) {
            const pieces = keywords
              .map(k => {
                const val = String(k.value || "").trim();
                if (!val) return null;
                // wrap multi-word terms in quotes
                const safe = val.includes(" ") ? `"${val}"` : val;
                return { text: safe, op: (k.operatorAfter || "AND").toUpperCase() };
              })
              .filter(Boolean);

            if (pieces.length === 0) {
                return res.status(400).json({ error: "No valid keywords provided" });
            }

            // join with operators -- last term has no trailing operator
            term = pieces.map((p, i) => (i < pieces.length - 1 ? `${p.text} ${p.op}` : p.text)).join(" ");
        } else if (req.body.term) {
            term = String(req.body.term).trim();
        }

        // Prepare E-utilities URL
        const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
        const params = new URLSearchParams({
          db: "pubmed",
          term: term,
          retmode: "json",
          retmax: String(Math.min(Math.max(parseInt(maxResults || 100, 10) || 1, 1), 10000)),
        });

        if (dateFrom) {
          params.set("datetype", "PDAT");
          params.set("mindate", String(dateFrom));
        }
        if (dateTo) {
          params.set("datetype", "PDAT");
          params.set("maxdate", String(dateTo));
        }

        const url = `${baseUrl}?${params.toString()}`;

        const response = await fetch(url);
        if (!response.ok) {
          const txt = await response.text().catch(()=>"");
          console.error("PubMed ESearch HTTP error", response.status, txt);
          return res.status(502).json({ error: "Bad response from PubMed ESearch" });
        }

        const data = await response.json();

        const esr = data && data.esearchresult ? data.esearchresult : {};
        const count = Number(esr.count || 0);
        const ids = Array.isArray(esr.idlist) ? esr.idlist : [];

        res.status(200).json({
            query: term,
            count,
            ids,
        });
    } catch (error) {
        console.error("❌ ESearch error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}