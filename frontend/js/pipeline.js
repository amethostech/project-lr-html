import { API_BASE_URL } from "../config/constants.js";

document.addEventListener("DOMContentLoaded", () => {
    const runBtn = document.getElementById("runPipelineBtn");
    runBtn.addEventListener("click", runPipeline);
});

async function runPipeline() {
    const target = document.getElementById("target").value.trim();
    const therapeuticArea = document.getElementById("therapeuticArea").value.trim();
    const affiliation = document.getElementById("affiliation").value.trim();
    const statusDiv = document.getElementById("status");

    if (!target || !therapeuticArea || !affiliation) {
        showStatus("Please fill in all fields (Target, Therapeutic Area, Affiliation).", "error");
        return;
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token') ||
        (function getCookie(name) {
            const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
            return m ? decodeURIComponent(m.pop()) : null;
        })('token');

    if (!token) {
        alert("You must be logged in to execute the pipeline.");
        window.location.href = '/pages/login.html';
        return;
    }

    showStatus("Starting pipeline execution...", "info");

    const payload = { target, therapeuticArea, affiliation };

    try {
        const response = await fetch(`${API_BASE_URL}/api/workflow/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            showStatus(data.message || "Pipeline started. Results will be emailed.", "info");
        } else {
            showStatus(data.error || "Failed to start pipeline.", "error");
        }
    } catch (error) {
        console.error("Pipeline submission error:", error);
        showStatus("An error occurred connecting to the server.", "error");
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById("status");
    statusDiv.style.display = "block";
    statusDiv.textContent = message;
    statusDiv.className = type === "error" ? "status-error" : "status-info";
}
