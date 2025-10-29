/********************************************************************
 * CONFIGURATION
 ********************************************************************/
const BACKEND_URL = "http://localhost:3000/api/pubmed/search";

/********************************************************************
 * STATE MANAGEMENT
 ********************************************************************/
const state = {
  keywords: [], 
};

/********************************************************************
 * HELPER: Build keyword input UI
 ********************************************************************/
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
    const opt = document.createElement("option");
    opt.value = o;
    opt.textContent = o;
    op.appendChild(opt);
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

function ensureStateKeywords() {
  state.keywords = state.keywords.slice(0, 5);
  while (state.keywords.length < 1)
    state.keywords.push({ value: "", operatorAfter: "AND" });
}

function renderKeywords() {
  const cont = document.getElementById("keywordsContainer");
  cont.innerHTML = "";
  if (state.keywords.length === 0)
    state.keywords.push({ value: "", operatorAfter: "AND" });
  state.keywords.forEach((k, i) => {
    cont.appendChild(createKeywordInput(i, k.value || "", k.operatorAfter || "AND"));
  });
}

/********************************************************************
 * MAIN SUBMIT HANDLER — Calls backend API
 ********************************************************************/
async function submitSearch() {
  const keywords = state.keywords
    .map(k => ({ value: k.value.trim(), operatorAfter: k.operatorAfter }))
    .filter(k => k.value.length > 0);

  if (keywords.length === 0) {
    alert("Please enter at least one keyword.");
    return;
  }

  const combinedTerm = keywords
    .map((k, i, arr) => {
      const val = k.value.includes(" ") ? `"${k.value}"` : k.value;
      return i < arr.length - 1 ? `${val} ${k.operatorAfter}` : val;
    })
    .join(" ");

  console.log("🔍 Search term built:", combinedTerm);

  // Read date range and maxResults from the page (expected inputs in HTML)
  const dateFrom = (document.getElementById("dateFrom") || {}).value || "";
  const dateTo = (document.getElementById("dateTo") || {}).value || "";
  const maxResultsInput = (document.getElementById("maxResults") || {}).value || "100";
  const maxResults = Math.min(Math.max(parseInt(maxResultsInput || "100", 10) || 1, 1), 1000);

  try {
    document.getElementById("status").textContent = "Searching PubMed...";

    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        maxResults
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status} - ${txt}`);
    }
    const data = await res.json();

    console.log(" PubMed ESearch Results:", data);

    document.getElementById("status").textContent =
      `Found ${data.count} records. Logged first ${data.ids.length} PMIDs in console.`;

  } catch (err) {
    console.error(" Error fetching PubMed data:", err);
    document.getElementById("status").textContent =
      "Error during search. Check console for details.";
  }
}

/********************************************************************
 * INIT
 ********************************************************************/

document.addEventListener("DOMContentLoaded", () => {
  const addBtn = document.getElementById("addKeyword");
  const remBtn = document.getElementById("removeKeyword");
  const submitBtn = document.getElementById("submitBtn");
  const clearBtn = document.getElementById("clearBtn");

  addBtn.addEventListener("click", () => {
    if (state.keywords.length >= 5)
      return alert("Maximum 5 keywords allowed.");
    state.keywords.push({ value: "", operatorAfter: "AND" });
    renderKeywords();
  });

  remBtn.addEventListener("click", () => {
    if (state.keywords.length <= 1) return;
    state.keywords.pop();
    renderKeywords();
  });

  submitBtn.addEventListener("click", submitSearch);

  clearBtn.addEventListener("click", () => {
    state.keywords = [{ value: "", operatorAfter: "AND" }];
    renderKeywords();
    document.getElementById("status").textContent = "Form cleared.";
  });

  renderKeywords();
});
