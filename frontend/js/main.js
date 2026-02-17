import { API_BASE_URL } from "../config/constants.js";
const DATABASES = [
    {
        id: "ncbi_gene",
        label: "NCBI Gene / Ensembl",
        group: "Genomics",
        fields: [
            { key: "organism", label: "Organism", type: "select", opts: ["Human", "Mouse", "Rat", "Other"] },
            { key: "gene_type", label: "Gene Type", type: "select", opts: ["Protein-coding", "Non-coding", "All"] },
            { key: "variant_type", label: "select_variant", labelAlt: "Variant Type", type: "select", opts: ["SNP", "CNV", "Indel", "Any"] }
        ]
    },
    {
        id: "pubchem",
        label: "PubChem / ChEMBL",
        group: "Molecules",
        fields: [
            { key: "molecule", label: "Molecule Name or CID", type: "text" },
            { key: "bioassay", label: "BioAssay Type", type: "select", opts: ["Binding", "Functional", "ADME", "Any"] },
            { key: "target_class", label: "Target Class", type: "text" }
        ]
    },
    {
        id: "clinicaltrials",
        label: "ClinicalTrials.gov",
        group: "Trials",
        fields: [
            { key: "phase", label: "Trial Phase", type: "select", opts: ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Any"] },
            { key: "status", label: "Status", type: "select", opts: ["Recruiting", "Completed", "Terminated", "Any"] },
            { key: "sponsor_type", label: "Sponsor Type", type: "select", opts: ["Industry", "Academic", "Govt", "Any"] }
        ]
    },
    {
        id: "pubmed",
        label: "PubMed / Europe PMC",
        group: "Publications",
        fields: [
            { key: "pub_type", label: "Publication Type", type: "select", opts: ["Review", "Clinical Trial", "Meta-analysis", "Any"] },
            { key: "author", label: "Author / Keyword", type: "text" },
            { key: "impact_filter", label: "Min Journal Impact Factor (optional)", type: "number" }
        ]
    },
    {
        id: "google_scholar",
        label: "Google Scholar (via SerpApi)",
        group: "Publications",
        fields: [
            { key: "as_ylo", label: "Year From (as_ylo)", type: "number" },
            { key: "as_yhi", label: "Year To (as_yhi)", type: "number" },
            { key: "as_sdt", label: "Search Type/Filter (as_sdt)", type: "select", opts: ["0 (Exclude Patents)", "7 (Include Patents)", "4 (Case Law)"] }
        ]
    },
    {
        id: "news",
        label: "News / Press Releases",
        group: "News",
        fields: [
            { key: "date_from", label: "Date From (YYYY-MM-DD)", type: "text" },
            { key: "date_to", label: "Date To (YYYY-MM-DD)", type: "text" },
            { key: "company", label: "Company/Drug Name", type: "text" },
            { key: "news_type", label: "Filter Type", type: "select", opts: ["M&A", "Regulatory", "Trial Result", "Patent", "Any"] }
        ]
    },
    {
        id: "patents",
        label: "Patents Database",
        group: "Intellectual Property",
        fields: [
            { key: "patent_office", label: "Patent Office", type: "select", opts: ["USPTO", "EPO", "WIPO", "Indian Patent Office", "Any"] },
            { key: "patent_status", label: "Patent Status", type: "select", opts: ["Granted", "Pending", "Expired", "Withdrawn", "Any"] },
            { key: "assignee", label: "Assignee / Applicant", type: "text" },
            { key: "inventor", label: "Inventor Name", type: "text" },
            { key: "date_from", label: "Filing Date From (YYYY-MM-DD)", type: "text" },
            { key: "date_to", label: "Filing Date To (YYYY-MM-DD)", type: "text" },
            { key: "keywords", label: "Patent Title / Abstract Keywords", type: "text" }
        ]
    },
];

/***************************************************************
 * STATE
 ***************************************************************/
const state = {
    keywords: [],
    dbParams: {},
    selectedDbs: new Set(),
    searchResults: [], // Array of { database, results: [], timestamp }
    activeDatabaseFilter: null, // null means show all
    activeDocument: null // Currently selected document for viewing
};

/***************************************************************
 * UI Helpers: Build keywords inputs and DB list
 ***************************************************************/
function createKeywordInput(index, value = "", operator = "AND") {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.gap = "6px";
    wrapper.style.alignItems = "center";

    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = `Keyword ${index + 1}`;
    inp.value = value;
    inp.dataset.idx = index;
    inp.addEventListener("input", () => {
        ensureStateKeywords();
        state.keywords[index].value = inp.value.trim();
    });

    const op = document.createElement("select");
    op.className = "operator";
    ["AND", "OR"].forEach(o => {
        const opt = document.createElement("option"); opt.value = o; opt.textContent = o; op.appendChild(opt);
    });
    op.value = operator;
    op.addEventListener("change", () => {
        ensureStateKeywords();
        state.keywords[index].operatorAfter = op.value;
    });

    wrapper.appendChild(inp);
    wrapper.appendChild(op);
    return wrapper;
}

function renderKeywords() {
    const cont = document.getElementById("keywordsContainer");
    cont.innerHTML = "";
    if (state.keywords.length === 0) {
        state.keywords.push({ value: "", operatorAfter: "AND" });
    }
    state.keywords.forEach((k, i) => {
        cont.appendChild(createKeywordInput(i, k.value || "", k.operatorAfter || "AND"));
    });
}

function ensureStateKeywords() {
    state.keywords = state.keywords.slice(0, 5);
    while (state.keywords.length < 1) state.keywords.push({ value: "", operatorAfter: "AND" });
}

// Add/remove keyword handlers
document.addEventListener("DOMContentLoaded", () => {
    const addBtn = document.getElementById("addKeyword");
    const remBtn = document.getElementById("removeKeyword");
    addBtn.addEventListener("click", () => {
        if (state.keywords.length >= 5) return alert("Maximum 5 keywords allowed.");
        state.keywords.push({ value: "", operatorAfter: "AND" });
        renderKeywords();
    });
    remBtn.addEventListener("click", () => {
        if (state.keywords.length <= 1) return;
        state.keywords.pop();
        renderKeywords();
    });
    renderKeywords();
    renderDbList();
    document.getElementById("submitBtn").addEventListener("click", submitSearch);
    document.getElementById("clearBtn").addEventListener("click", clearForm);
});

/***************************************************************
 * Render DB list with checkboxes and hookup modal open (only
 * for databases that have backend controllers/endpoints wired).
 ***************************************************************/
function renderDbList() {
    const root = document.getElementById("dbList");
    root.innerHTML = "";

    const allCheckboxes = [];

    // Only show databases that are actually supported by the backend.
    const SUPPORTED_DB_IDS = new Set(["pubmed", "google_scholar", "clinicaltrials", "patents", "pubchem"]);

    DATABASES.filter(db => SUPPORTED_DB_IDS.has(db.id)).forEach(db => {
        const item = document.createElement("label");
        item.className = "db-item";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.style.transform = "scale(1.1)";
        cb.dataset.dbid = db.id;

        allCheckboxes.push(cb);

        cb.addEventListener("change", (e) => {
            const id = e.target.dataset.dbid;

            if (e.target.checked) {
                // Allow multiple selections: just add this DB and open its config.
                state.selectedDbs.add(id);
                openDbModal(db);
            } else {
                state.selectedDbs.delete(id);
                delete state.dbParams[id];
            }
        });

        const name = document.createElement("div");
        name.style.flex = "1";
        name.innerHTML = `<strong style="display:block">${db.label}</strong><span class="small">${db.group}</span>`;

        const cfgBut = document.createElement("button");
        cfgBut.type = "button";
        cfgBut.className = "btn-ghost";
        cfgBut.textContent = "Edit";
        cfgBut.addEventListener("click", () => {
            // If not yet selected, select and open its configuration.
            if (!state.selectedDbs.has(db.id)) {
                cb.checked = true;
                cb.dispatchEvent(new Event('change'));
            } else {
                openDbModal(db);
            }
        });

        item.appendChild(cb);
        item.appendChild(name);
        item.appendChild(cfgBut);
        root.appendChild(item);
    });
}

/***************************************************************
 * Modal: Build DB config modal based on database.fields
 ***************************************************************/
function openDbModal(dbDef) {
    const root = document.getElementById("modalRoot");
    root.style.display = "block";
    root.innerHTML = `
        <div class="modal-backdrop" id="modalBackdrop">
          <div class="modal card" role="dialog" aria-modal="true">
            <h3>Configure: ${dbDef.label}</h3>
            <div id="modalForm"></div>
            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
              <button id="modalCancel" class="btn-ghost">Cancel</button>
              <button id="modalSave">Save</button>
            </div>
          </div>
        </div>
      `;

    const modalForm = document.getElementById("modalForm");
    modalForm.style.maxHeight = "60vh";
    modalForm.style.overflow = "auto";

    // populate fields with current saved params if any
    const current = state.dbParams[dbDef.id] || {};

    dbDef.fields.forEach(f => {
        const wrapper = document.createElement("div");
        wrapper.style.marginBottom = "10px";
        const label = document.createElement("label");
        label.textContent = (f.labelAlt || f.label);
        wrapper.appendChild(label);

        let fieldEl;
        if (f.type === "select") {
            fieldEl = document.createElement("select");
            f.opts.forEach(o => { const opt = document.createElement("option"); opt.value = o; opt.textContent = o; fieldEl.appendChild(opt); });
            fieldEl.value = current[f.key] || f.opts[0];
        } else if (f.type === "number") {
            fieldEl = document.createElement("input");
            fieldEl.type = "number";
            fieldEl.value = current[f.key] || "";
        } else {
            // text or default
            fieldEl = document.createElement("input");
            fieldEl.type = "text";
            fieldEl.value = current[f.key] || "";
        }
        fieldEl.dataset.fieldKey = f.key;
        wrapper.appendChild(fieldEl);
        modalForm.appendChild(wrapper);
    });

    document.getElementById("modalCancel").addEventListener("click", () => {
        // If user cancels and db wasn't previously saved, uncheck
        if (!state.dbParams[dbDef.id]) {
            // uncheck checkbox in db list
            document.querySelector(`input[data-dbid="${dbDef.id}"]`).checked = false;
            state.selectedDbs.delete(dbDef.id);
        }
        root.style.display = "none";
        root.innerHTML = "";
    });

    document.getElementById("modalSave").addEventListener("click", () => {
        // collect values
        const inputs = modalForm.querySelectorAll("[data-field-key]");
        const params = {};
        inputs.forEach(inp => {
            const key = inp.dataset.fieldKey;
            params[key] = inp.value;
        });
        state.dbParams[dbDef.id] = params;
        root.style.display = "none";
        root.innerHTML = "";
        showStatus(`Saved settings for ${dbDef.label}`, 3000);
    });
}

/***************************************************************
 * Submit: Collect all fields and POST to backend API 
 ***************************************************************/
async function submitSearch() {
    const selectedDbs = Array.from(state.selectedDbs);
    const newsSelected = document.getElementById("newsArticles")?.checked || false;

    // Require authentication for any outbound search
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') ||
        (function getCookie(name) {
            const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
            return m ? decodeURIComponent(m.pop()) : null;
        })('token');

    if (!token) {
        alert("You must be logged in to perform searches. Redirecting to login page...");
        window.location.href = '/pages/login.html';
        return;
    }

    if (!newsSelected && selectedDbs.length === 0) {
        alert("Please select at least one database or enable the News Articles option.");
        return;
    }

    // Run the curated news search first if requested
    if (newsSelected) {
        try {
            await performNewsArticlesSearch();
        } catch (error) {
            console.error("Error during news articles search:", error);
            showStatus(`Error searching news articles: ${error.message || error}`, 5000);
        }
    }

    // If no databases were selected, we're done
    if (selectedDbs.length === 0) {
        return;
    }

    // If multiple databases selected, search each one sequentially
    if (selectedDbs.length > 1) {
        showStatus(`Searching ${selectedDbs.length} databases...`, 0);

        for (let i = 0; i < selectedDbs.length; i++) {
            const database = selectedDbs[i];
            const dbName = DATABASES.find(db => db.id === database)?.label || database;
            showStatus(`Searching ${i + 1}/${selectedDbs.length}: ${dbName}...`, 0);

            try {
                await performSingleDatabaseSearch(database);
            } catch (error) {
                console.error(`Error searching ${database}:`, error);
                showStatus(`Error searching ${dbName}`, 3000);
            }
        }

        showStatus(`✅ Completed searches for ${selectedDbs.length} databases. All results saved to consolidated Excel!`, 7000);
        return;
    }

    // Single database search
    const database = selectedDbs[0];
    await performSingleDatabaseSearch(database);
}

/**
 * Trigger a news‑only search against the curated CSV store.
 * This sends results to the authenticated user's e‑mail via the backend.
 */
async function performNewsArticlesSearch() {
    const endpointPath = '/api/news/search';
    const DYNAMIC_BACKEND_URL = `${API_BASE_URL}${endpointPath}`;

    const keywords = state.keywords
        .map(k => (k && k.value ? String(k.value).trim() : ''))
        .filter(v => v.length > 0);

    if (keywords.length === 0) {
        alert("Please enter at least one keyword to search news articles.");
        return;
    }

    const maxResultsInput = (document.getElementById("maxResults") || {}).value || "100";
    const maxResults = Math.min(Math.max(parseInt(maxResultsInput || "100", 10) || 1, 1), 10000);

    const payload = {
        keywords,
        maxResults
    };

    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token') ||
            (function getCookie(name) {
                const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
                return m ? decodeURIComponent(m.pop()) : null;
            })('token');

        const headers = { "Content-Type": "application/json" };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        showStatus("Submitting news articles search...", 0);

        const resp = await fetch(DYNAMIC_BACKEND_URL, {
            method: "POST",
            mode: "cors",
            headers,
            body: JSON.stringify(payload)
        });

        const text = await resp.text().catch(() => "");
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error("Failed to parse news search response JSON:", e, "raw response:", text);
            throw new Error(`Server returned invalid response. Status: ${resp.status}`);
        }

        if (!resp.ok) {
            const errorMsg = data.error || data.message || `HTTP ${resp.status}: ${resp.statusText}`;
            throw new Error(errorMsg);
        }

        const msg = data.message || `News articles search submitted. Results will be emailed to ${data.recipientEmail || 'your email'} shortly.`;
        showStatus(`✅ ${msg}`, 7000);
    } catch (err) {
        console.error("❌ News articles search error:", err);
        const message = err.message || "Unknown error occurred";
        showStatus(`Error: ${message}`, 7000);
        alert(`News articles search failed: ${message}\n\nCheck browser console (F12) for more details.`);
        throw err;
    }
}

async function performSingleDatabaseSearch(database) {
    let endpointPath;
    let isUspto = false;
    let isPubchem = false;

    if (database === 'pubmed') {
        endpointPath = '/api/pubmed/search';
    } else if (database === 'google_scholar') {
        endpointPath = '/api/google/googlescholar';
    } else if (database === 'uspto' || database === 'patents') {
        endpointPath = '/api/uspto/search';
        isUspto = true;
    } else if (database === 'clinicaltrials') {
        endpointPath = '/api/search';
    } else if (database === 'pubchem') {
        endpointPath = '/api/pubchem/search';
        isPubchem = true;
    } else {
        return alert(`Search for database ${database} is not supported.`);
    }

    const DYNAMIC_BACKEND_URL = `${API_BASE_URL}${endpointPath}`;

    // --- Core Payload Construction ---
    const keywords = state.keywords
        .map(k => ({ value: k.value || "", operatorAfter: k.operatorAfter || "AND" }))
        .filter(k => k.value && k.value.trim().length > 0);

    // Read dateFrom/dateTo and maxResults
    const dateFrom = (document.getElementById("dateFrom") || {}).value || null;
    const dateTo = (document.getElementById("dateTo") || {}).value || null;
    const maxResultsInput = (document.getElementById("maxResults") || {}).value || "100";
    const maxResults = Math.min(Math.max(parseInt(maxResultsInput || "100", 10) || 1, 1), 10000);

    // Allow empty keywords if user has a date range or db-specific filters set
    if (keywords.length === 0 && !dateFrom && !dateTo && !Object.keys(state.dbParams[database] || {}).length) {
        return alert("Please enter at least one keyword or a date range.");
    }

    // regions (multi-select)
    const regionsSelect = document.getElementById("regions");
    const selectedRegions = Array.from(regionsSelect.selectedOptions).map(o => o.value);

    // selected DBs and their params (for this specific database)
    const dbParams = {};
    dbParams[database] = state.dbParams[database] || {};

    const query = keywords.map((k, i) => {
        const text = k.value.includes(' ') ? `"${k.value}"` : k.value;
        return i < keywords.length - 1 ? `${text} ${k.operatorAfter}` : text;
    }).join(' ');

    // Build payload - different format for USPTO and PubChem
    let payload;
    if (isUspto) {
        // USPTO expects: { keywords: string[], operator: "AND"|"OR", limit: number }
        const keywordValues = keywords.map(k => k.value);
        const operator = keywords.length > 1 ? keywords[0].operatorAfter || 'AND' : 'AND';
        payload = {
            keywords: keywordValues,
            operator: operator.toUpperCase(),
            limit: maxResults,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined
        };
    } else if (isPubchem) {
        // PubChem expects: { molecule, bioassay, target_class }
        const pubParams = dbParams.pubchem || {};
        const moleculeVal = (pubParams.molecule && String(pubParams.molecule).trim()) || query || "";
        const bioassayVal = (pubParams.bioassay && String(pubParams.bioassay).trim()) || "Any";
        const targetClassVal = (pubParams.target_class && String(pubParams.target_class).trim()) || "";

        payload = {
            molecule: moleculeVal,
            bioassay: bioassayVal,
            target_class: targetClassVal
        };
    } else {
        // Standard payload for other databases
        payload = {
            timestamp: new Date().toISOString(),
            query,
            database,
            keywords,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            maxResults,
            regions: selectedRegions,
            selectedDbs: [database],
            dbParams,
            source: "hostinger_frontend_v1"
        };
    }

    // --- Fetch Logic ---

    try {
        const token =
            localStorage.getItem('token') ||
            sessionStorage.getItem('token') ||
            (function getCookie(name) {
                const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
                return m ? decodeURIComponent(m.pop()) : null;
            })('token');

        const headers = { "Content-Type": "application/json" };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        } else {
            console.warn('No auth token found in local/session storage or cookies.');
        }

        const resp = await fetch(DYNAMIC_BACKEND_URL, {
            method: "POST",
            mode: "cors",
            headers,
            body: JSON.stringify(payload)
        });

        const text = await resp.text().catch(() => "");
        let data = {};
        try {
            data = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error("Failed to parse response JSON:", e, "raw response:", text);
            throw new Error(`Server returned invalid response. Status: ${resp.status}`);
        }

        if (!resp.ok) {
            const errorMsg = data.error || data.message || `HTTP ${resp.status}: ${resp.statusText}`;
            console.error("Server error:", errorMsg, "Full response:", data);
            throw new Error(errorMsg);
        }

        console.log("✅ Server response:", data);

        // Extract and store results for display
        let resultsToDisplay = [];
        if (isUspto) {
            // USPTO returns: { success, results, total, shown, query, message }
            // Note: Currently USPTO processes in background, so results may not be in response
            if (data && data.success && data.results && Array.isArray(data.results)) {
                resultsToDisplay = data.results.map(result => {
                    // Extract abstract from various possible fields
                    let abstract = result.abstract ||
                        result.abstractText ||
                        result.Abstract ||
                        result.abstractText_en ||
                        result.abstract_en ||
                        result.description ||
                        result.Description ||
                        (result.abstract && Array.isArray(result.abstract) ? result.abstract.join(' ') : null) ||
                        (result.description && Array.isArray(result.description) ? result.description.join(' ') : null) ||
                        'No abstract available';

                    // If abstract is an array, join it
                    if (Array.isArray(abstract)) {
                        abstract = abstract.join(' ');
                    }

                    // Extract title from various possible fields
                    const title = result.title ||
                        result.titleText ||
                        result.inventionTitle ||
                        result.InventionTitle ||
                        result.title_en ||
                        result.patentTitle ||
                        'Untitled Patent';

                    // Extract publication year
                    const pubDate = result.pubDate ||
                        result.grantDate ||
                        result.publicationDate ||
                        result.PublicationDate ||
                        result.issueDate ||
                        result.IssueDate ||
                        null;

                    let pubYear = 'N/A';
                    if (pubDate) {
                        // Try to extract year from date string
                        const yearMatch = String(pubDate).match(/(\d{4})/);
                        if (yearMatch) {
                            pubYear = yearMatch[1];
                        }
                    }

                    return {
                        ...result,
                        Source: 'USPTO',
                        Title: title,
                        Abstract: abstract,
                        Authors: result.inventor || result.inventorName || result.inventorNameText || result.Inventor || 'N/A',
                        'Publication Year': pubYear,
                        'DOI/PMID': result.patentNumber || result.patentNumberText || result.patentNo || result.publicationNumber || result.PublicationNumber || 'N/A'
                    };
                });
                showStatus(`Found ${data.total || 0} total results. Showing ${data.shown || 0} results. Saved to consolidated Excel!`, 7000);
            } else if (data && data.status === 'processing') {
                // Background processing - results will be emailed
                showStatus(`Search submitted! Results will be emailed to you. Check your email shortly.`, 7000);
            } else {
                showStatus(data.message || "Submitted successfully ✅", 5000);
            }
        } else if (data && data.results && Array.isArray(data.results)) {
            // Standard format: { count, results: [...] } - ClinicalTrials returns this
            resultsToDisplay = data.results;
            const dbName = DATABASES.find(db => db.id === database)?.label || database;
            showStatus(`Found ${data.count || resultsToDisplay.length} records from ${dbName}. Saved to consolidated Excel!`, 7000);
        } else if (data && data.status === 'processing' || data.status === 'success') {
            // Background processing (PubMed, Google Scholar) - results will be emailed
            const dbName = DATABASES.find(db => db.id === database)?.label || database;
            showStatus(`Search submitted for ${dbName}! Results will be emailed to you. Check your email shortly.`, 7000);
        } else if (data && typeof data.count !== "undefined") {
            showStatus(`Found ${data.count} records from ${database}. Saved to consolidated Excel!`, 7000);
        } else {
            showStatus("Submitted successfully ✅ - Results saved to consolidated Excel!", 5000);
        }

        // Store results for display (only if we have actual results)
        if (resultsToDisplay.length > 0) {
            const dbName = DATABASES.find(db => db.id === database)?.label || database;
            state.searchResults.push({
                database: database,
                databaseLabel: dbName,
                results: resultsToDisplay,
                timestamp: new Date().toISOString()
            });
            renderResults();
        }
    } catch (err) {
        console.error("❌ Search error:", err);
        const errorMessage = err.message || "Unknown error occurred";
        showStatus(`Error: ${errorMessage}`, 7000);
        alert(`Submission failed: ${errorMessage}\n\nCheck browser console (F12) for more details.`);
        throw err; // Re-throw for multiple database handling
    }
}

function showStatus(msg, ttl = 2000) {
    const s = document.getElementById("status");
    s.textContent = msg;
    if (ttl) setTimeout(() => { if (s.textContent === msg) s.textContent = ""; }, ttl);
}

function clearForm() {
    state.keywords = [{ value: "", operatorAfter: "AND" }];
    state.dbParams = {};
    state.selectedDbs = new Set();
    renderKeywords();
    document.querySelectorAll("#dbList input[type=checkbox]").forEach(cb => cb.checked = false);
    document.getElementById("dateFrom").value = "";
    document.getElementById("dateTo").value = "";
    document.getElementById("regions").selectedIndex = 0;
    document.getElementById("maxResults").value = "100";
    const newsCheckbox = document.getElementById("newsArticles");
    if (newsCheckbox) {
        newsCheckbox.checked = false;
    }
    showStatus("Form cleared", 2000);
    // Note: Search results are NOT cleared by clearForm - use "Clear Results" button in viewer
}

/***************************************************************
 * Document Viewer Functions
 ***************************************************************/

function renderResults() {
    const viewerSection = document.getElementById("documentViewerSection");
    const emptyState = document.getElementById("emptyState");
    const resultsListContent = document.getElementById("resultsListContent");
    const resultsCount = document.getElementById("resultsCount");
    const databaseFilters = document.getElementById("databaseFilters");
    const databaseTags = document.getElementById("databaseTags");
    const clearResultsBtn = document.getElementById("clearResultsBtn");

    if (state.searchResults.length === 0) {
        if (viewerSection) viewerSection.style.display = "none";
        if (emptyState) emptyState.style.display = "flex";
        return;
    }

    if (viewerSection) viewerSection.style.display = "block";
    if (emptyState) emptyState.style.display = "none";

    // Get all unique databases
    const uniqueDatabases = [...new Set(state.searchResults.map(r => r.database))];

    // Show/hide database filters
    if (uniqueDatabases.length > 1) {
        databaseFilters.style.display = "block";

        // Render database filter tags
        databaseTags.innerHTML = "";

        // Add "All" tag
        const allTag = document.createElement("button");
        allTag.className = `database-tag-filter all ${state.activeDatabaseFilter === null ? 'active' : ''}`;
        allTag.textContent = "All";
        allTag.addEventListener("click", () => {
            state.activeDatabaseFilter = null;
            renderResults();
        });
        databaseTags.appendChild(allTag);

        // Add individual database tags
        uniqueDatabases.forEach(dbId => {
            const dbResult = state.searchResults.find(r => r.database === dbId);
            const dbLabel = dbResult ? dbResult.databaseLabel : dbId;
            const tag = document.createElement("button");
            tag.className = `database-tag-filter ${state.activeDatabaseFilter === dbId ? 'active' : ''}`;
            tag.textContent = dbLabel;
            tag.addEventListener("click", () => {
                state.activeDatabaseFilter = dbId;
                renderResults();
            });
            databaseTags.appendChild(tag);
        });
    } else {
        databaseFilters.style.display = "none";
    }

    // Filter results based on active database filter
    let filteredResults = [];
    if (state.activeDatabaseFilter === null) {
        // Show all results
        state.searchResults.forEach(dbResult => {
            dbResult.results.forEach((result, index) => {
                filteredResults.push({
                    ...result,
                    _database: dbResult.database,
                    _databaseLabel: dbResult.databaseLabel,
                    _index: index
                });
            });
        });
    } else {
        // Show only results from selected database
        const dbResult = state.searchResults.find(r => r.database === state.activeDatabaseFilter);
        if (dbResult) {
            dbResult.results.forEach((result, index) => {
                filteredResults.push({
                    ...result,
                    _database: dbResult.database,
                    _databaseLabel: dbResult.databaseLabel,
                    _index: index
                });
            });
        }
    }

    // Update results count
    resultsCount.textContent = `${filteredResults.length} document${filteredResults.length !== 1 ? 's' : ''} found`;

    // Render results list
    resultsListContent.innerHTML = "";

    if (filteredResults.length === 0) {
        resultsListContent.innerHTML = `
            <p class="small" style="color: var(--muted); text-align: center; padding: 40px 0;">
                No results to display.
            </p>
        `;
        return;
    }

    filteredResults.forEach((result, idx) => {
        const item = document.createElement("div");
        const docId = `${result._database}_${result._index}`;
        const isActive = state.activeDocument === docId;
        item.className = `result-item ${isActive ? 'active' : ''}`;
        item.style.cursor = 'pointer';
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');
        item.setAttribute('aria-label', `View document: ${result.Title || result.title || 'Untitled'}`);

        // Click handler
        const handleClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("Document clicked:", docId, result);
            state.activeDocument = docId;
            state._skipAutoRender = true; // Prevent auto-render in renderResults
            // Store the result for the viewer (deep copy to avoid reference issues)
            const selectedResult = JSON.parse(JSON.stringify(result));
            // Re-render the list first to update active states
            renderResults();
            // Then render the viewer with the selected document
            renderDocumentViewer(selectedResult);
        };

        item.addEventListener("click", handleClick);
        // Also support keyboard navigation
        item.addEventListener("keydown", (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick(e);
            }
        });

        const title = result.Title || result.title || 'Untitled';
        const authors = result.Authors || result.authors || result.Author || 'N/A';
        const year = result['Publication Year'] || result.year || result.pubYear || 'N/A';
        const abstract = result.Abstract || result.abstract || result.snippet || 'No abstract available';
        const source = result.Source || result._databaseLabel || 'Unknown';

        item.innerHTML = `
            <div class="result-item-title">${escapeHtml(title)}</div>
            <div class="result-item-meta">${escapeHtml(authors)} • ${escapeHtml(String(year))}</div>
            <div class="result-item-abstract">${escapeHtml(abstract)}</div>
            <div class="result-item-tags">
                <span class="result-tag">${escapeHtml(source)}</span>
            </div>
        `;

        resultsListContent.appendChild(item);
    });

    // If there's an active document and we're not in a click handler, render it in the viewer
    // (Click handler will render it separately to avoid conflicts)
    if (state.activeDocument && !state._skipAutoRender) {
        const activeDoc = filteredResults.find(r => `${r._database}_${r._index}` === state.activeDocument);
        if (activeDoc) {
            renderDocumentViewer(activeDoc);
        } else {
            // Active document might be from a different filter, try to find it in all results
            let foundDoc = null;
            for (const dbResult of state.searchResults) {
                for (let i = 0; i < dbResult.results.length; i++) {
                    const docId = `${dbResult.database}_${i}`;
                    if (docId === state.activeDocument) {
                        foundDoc = {
                            ...dbResult.results[i],
                            _database: dbResult.database,
                            _databaseLabel: dbResult.databaseLabel,
                            _index: i
                        };
                        break;
                    }
                }
                if (foundDoc) break;
            }
            if (foundDoc) {
                renderDocumentViewer(foundDoc);
            } else {
                renderDocumentViewer(null);
            }
        }
    } else if (!state.activeDocument) {
        renderDocumentViewer(null);
    }

    // Reset the flag after rendering
    if (state._skipAutoRender) {
        state._skipAutoRender = false;
    }

    // Show clear results and download buttons
    clearResultsBtn.style.display = "block";
    const downloadBtn = document.getElementById("downloadDataBtn");
    if (downloadBtn) {
        downloadBtn.style.display = "block";
        downloadBtn.onclick = () => downloadSearchResults();
    }

    clearResultsBtn.onclick = () => {
        if (confirm("Clear all search results?")) {
            state.searchResults = [];
            state.activeDatabaseFilter = null;
            state.activeDocument = null;
            renderResults();
        }
    };
}

function renderDocumentViewer(docData) {
    const viewerContent = document.getElementById("documentViewerContent");
    const closeViewerBtn = document.getElementById("closeViewerBtn");

    if (!viewerContent) {
        console.error("Document viewer content element not found");
        return;
    }

    if (!docData) {
        viewerContent.innerHTML = `
            <p class="empty-state">
                Click on a document from the list to view its details here.
            </p>
        `;
        if (closeViewerBtn) closeViewerBtn.style.display = "none";
        return;
    }

    console.log("Rendering document viewer with:", docData);

    closeViewerBtn.style.display = "block";
    closeViewerBtn.onclick = () => {
        state.activeDocument = null;
        renderResults();
        renderDocumentViewer(null);
    };

    // Build document viewer HTML
    const fields = [
        { label: 'Title', key: 'Title', altKeys: ['title'] },
        { label: 'Authors', key: 'Authors', altKeys: ['authors', 'Author'] },
        { label: 'Publication Year', key: 'Publication Year', altKeys: ['year', 'pubYear'] },
        { label: 'Source', key: 'Source', altKeys: ['_databaseLabel'] },
        { label: 'DOI/PMID', key: 'DOI/PMID', altKeys: ['DOI_PMID', 'doi', 'pmid'] },
        { label: 'Abstract', key: 'Abstract', altKeys: ['abstract', 'snippet'], isAbstract: true }
    ];

    let html = '';
    fields.forEach(field => {
        let value = docData[field.key];
        if (!value && field.altKeys) {
            for (const altKey of field.altKeys) {
                if (docData[altKey]) {
                    value = docData[altKey];
                    break;
                }
            }
        }

        if (value && value !== 'N/A') {
            const fieldClass = field.isAbstract ? 'abstract' : '';
            html += `
                <div class="document-field">
                    <div class="document-field-label">${escapeHtml(field.label)}:</div>
                    <div class="document-field-value ${fieldClass}">${escapeHtml(String(value))}</div>
                </div>
            `;
        }
    });

    // Add any additional fields that might be present
    const displayedKeys = new Set(['Title', 'title', 'Authors', 'authors', 'Author', 'Publication Year', 'year', 'pubYear',
        'Source', '_databaseLabel', 'DOI/PMID', 'DOI_PMID', 'doi', 'pmid', 'Abstract', 'abstract', 'snippet',
        '_database', '_databaseLabel', '_index']);

    Object.keys(docData).forEach(key => {
        if (!displayedKeys.has(key) && docData[key] && docData[key] !== 'N/A' && typeof docData[key] === 'string') {
            html += `
                <div class="document-field">
                    <div class="document-field-label">${escapeHtml(key)}:</div>
                    <div class="document-field-value">${escapeHtml(String(docData[key]))}</div>
                </div>
            `;
        }
    });

    viewerContent.innerHTML = html || `
        <p class="small" style="color: var(--muted); text-align: center; padding: 40px 0;">
            No details available for this document.
        </p>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/***************************************************************
 * Download Search Results as CSV
 ***************************************************************/
function downloadSearchResults() {
    if (state.searchResults.length === 0) {
        alert("No search results to download.");
        return;
    }

    // Flatten all results from all databases
    let allResults = [];
    state.searchResults.forEach(dbResult => {
        dbResult.results.forEach(result => {
            allResults.push({
                Source: dbResult.databaseLabel || dbResult.database,
                Title: result.Title || result.title || 'Untitled',
                Authors: result.Authors || result.authors || result.Author || result.inventor || 'N/A',
                'Publication Year': result['Publication Year'] || result.year || result.pubYear || 'N/A',
                'DOI/PMID': result['DOI/PMID'] || result.DOI_PMID || result.doi || result.pmid || result.patentNumber || 'N/A',
                Abstract: result.Abstract || result.abstract || result.snippet || 'No abstract available',
                URL: result.url || result.URL || result.link || ''
            });
        });
    });

    if (allResults.length === 0) {
        alert("No data to download.");
        return;
    }

    // Define CSV headers
    const headers = ['Source', 'Title', 'Authors', 'Publication Year', 'DOI/PMID', 'Abstract', 'URL'];

    // Convert to CSV format
    const csvContent = convertToCSV(allResults, headers);

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    // Generate filename with date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `search_results_${dateStr}_${timeStr}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showStatus(`✅ Downloaded ${allResults.length} results as CSV`, 5000);
}

/**
 * Convert array of objects to CSV string
 */
function convertToCSV(data, headers) {
    const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    // Create header row
    let csv = headers.map(escapeCSV).join(',') + '\n';

    // Create data rows
    data.forEach(row => {
        const values = headers.map(header => escapeCSV(row[header]));
        csv += values.join(',') + '\n';
    });

    return csv;
}

/***************************************************************
 * INIT
 ***************************************************************/
document.addEventListener("DOMContentLoaded", () => {
    const addBtn = document.getElementById("addKeyword");
    const remBtn = document.getElementById("removeKeyword");
    const submitBtn = document.getElementById("submitBtn");
    const clearBtn = document.getElementById("clearBtn");

    addBtn.addEventListener("click", () => {
        if (state.keywords.length >= 5) return alert("Maximum 5 keywords allowed.");
        state.keywords.push({ value: "", operatorAfter: "AND" });
        renderKeywords();
    });

    remBtn.addEventListener("click", () => {
        if (state.keywords.length <= 1) return;
        state.keywords.pop();
        renderKeywords();
    });

    submitBtn.addEventListener("click", submitSearch);
    clearBtn.addEventListener("click", clearForm);

    renderKeywords();
    renderDbList();
});