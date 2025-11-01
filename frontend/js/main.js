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
    selectedDbs: new Set()
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
 * Render DB list with checkboxes and hookup modal open (UPDATED)
 ***************************************************************/
function renderDbList() {
    const root = document.getElementById("dbList");
    root.innerHTML = "";
    
    const allCheckboxes = [];

    DATABASES.forEach(db => {
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
                // --- ENFORCE SINGLE SELECTION ---
                state.selectedDbs.clear(); // Clear all selections in state
                allCheckboxes.forEach(otherCb => {
                    if (otherCb !== cb) {
                        otherCb.checked = false; // Uncheck other UIs
                    }
                });
                state.selectedDbs.add(id); // Add the newly selected one

                // open modal to configure
                openDbModal(db);
            } else {
                state.selectedDbs.delete(id);
                // clear stored params for that db (optional, but clean)
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
        cfgBut.addEventListener("click", (e) => {
            // If not checked, check it (and uncheck others)
            if (!state.selectedDbs.has(db.id)) {
                 // Trigger the change handler manually to enforce single selection logic
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
    if (selectedDbs.length !== 1) return alert("Please select exactly one database to search.");

    const database = selectedDbs[0]; // The single selected DB ID
    let endpointPath;
    
    if (database === 'pubmed') {
        endpointPath = '/api/pubmed';
    } else if (database === 'google_scholar') {
        endpointPath = '/api/google/googlescholar'; 
    } else {
        return alert(`Search for database ${database} is not supported.`);
    }

    const DYNAMIC_BACKEND_URL = `${API_BASE_URL}${endpointPath}`;

    // --- Core Payload Construction ---
    const keywords = state.keywords
        .map(k => ({ value: k.value || "", operatorAfter: k.operatorAfter || "AND" }))
        .filter(k => k.value && k.value.trim().length > 0);

    if (keywords.length === 0) return alert("Please enter at least one keyword.");

    // Read dateFrom/dateTo and maxResults
    const dateFrom = (document.getElementById("dateFrom") || {}).value || null;
    const dateTo = (document.getElementById("dateTo") || {}).value || null;
    const maxResultsInput = (document.getElementById("maxResults") || {}).value || "100";
    const maxResults = Math.min(Math.max(parseInt(maxResultsInput || "100", 10) || 1, 1), 10000);

    // regions (multi-select)
    const regionsSelect = document.getElementById("regions");
    const selectedRegions = Array.from(regionsSelect.selectedOptions).map(o => o.value);

    // selected DBs and their params
    const dbParams = {};
    selectedDbs.forEach(id => { dbParams[id] = state.dbParams[id] || {}; });
    
    const query = keywords.map((k, i) => {
        const text = k.value.includes(' ') ? `"${k.value}"` : k.value;
        return i < keywords.length - 1 ? `${text} ${k.operatorAfter}` : text;
    }).join(' ');

    const payload = {
        timestamp: new Date().toISOString(),
        query,               
        database,          
        keywords,            
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        maxResults,
        regions: selectedRegions,
        selectedDbs,
        dbParams,
        source: "hostinger_frontend_v1"
    };

    // --- Fetch Logic ---

    try {
        showStatus("Submitting…");
        
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
        try { data = text ? JSON.parse(text) : {}; } catch (e) {
            console.warn("Failed to parse response JSON:", e, "raw:", text);
        }

        if (!resp.ok) {
            throw new Error(data && data.error ? data.error : `Status ${resp.status}`);
        }

        console.log("✅ Server response:", data);
        
        if (data && typeof data.count !== "undefined") {
            showStatus(`Found ${data.count} records from ${database}.`, 7000);
        } else {
            showStatus("Submitted successfully ✅", 5000);
        }
    } catch (err) {
        console.error(err);
        showStatus("Error submitting — check console.", 7000);
        alert("Submission failed. Open browser console for details.");
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
    showStatus("Form cleared", 2000);
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