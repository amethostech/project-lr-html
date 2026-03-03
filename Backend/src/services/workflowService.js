import { fetchStudies } from './clinicalService.js';
import { searchPubMedUtil } from './pubmedService.js';
import { searchUsptoDsapi } from './usptoService.js';
import { confirmTarget } from './openTargetsService.js';
import { logInfo, logError } from '../utils/logger.js';
import ExcelJS from 'exceljs';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = util.promisify(exec);

const get10YearsAgoDate = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 10);
    return date.toISOString().split('T')[0].replace(/-/g, '/');
};

const getTodayDate = () => {
    return new Date().toISOString().split('T')[0].replace(/-/g, '/');
};

export async function executeFixedPipeline(target, therapeuticArea, affiliation) {
    logInfo(`[Workflow] Starting fixed pipeline for Target: ${target}, TA: ${therapeuticArea}, Affiliation: ${affiliation}`);

    const workbook = new ExcelJS.Workbook();
    const dateFrom10 = get10YearsAgoDate();
    const dateTo = getTodayDate();

    try {
        // Step 1: Clinical Trials
        logInfo('[Workflow] Step 1: Clinical Trials ONCO, DRUG INTERVENTION');
        const ctRes = await fetchStudies({
            condition: therapeuticArea,
            intervention: 'Drug', // Maps to DRUG INTERVENTION
            maxResults: 500
        });
        const s1Data = ctRes.formatted.map(r => ({
            'Study Overview': r.title,
            'Study Plan': r.studyType,
            'Drug Name': r.interventions,
            'Phase': r.phases,
            'Disease Name': r.conditions,
            'Therapeutic Area': therapeuticArea
        }));
        addSheet(workbook, 'Step 1 - Clinical Trials', s1Data);

        // Save for python script usage
        logInfo('[Workflow] Saving Step 1 data for Python scripts (Clinical_Trials_2025.xlsx)');
        const tempWb = new ExcelJS.Workbook();
        addSheet(tempWb, 'Data', ctRes.formatted); // Raw formatted data
        const ctFilePath = path.resolve('../Clinical_Trials_2025.xlsx');
        await tempWb.xlsx.writeFile(ctFilePath);

        // Step 2: OpenTargets
        logInfo('[Workflow] Step 2: OpenTargets');
        const otRes = await confirmTarget(target);
        addSheet(workbook, 'Step 2 - OpenTargets', otRes);

        // Step 3: PubMed Target (10 year) Count
        logInfo('[Workflow] Step 3: PubMed Target Count');
        const p3Res = await searchPubMedUtil(target, dateFrom10, dateTo, 1);
        addSheet(workbook, 'Step 3 - PubMed Target Count', [{ Query: target, 'Count of Publication': p3Res.count }]);

        // Step 4: PubMed Therapeutic Area
        logInfo('[Workflow] Step 4: PubMed TA Count');
        const p4Res = await searchPubMedUtil(`"${therapeuticArea}"`, dateFrom10, dateTo, 1);
        addSheet(workbook, 'Step 4 - PubMed TA Count', [{ Query: `"${therapeuticArea}"`, 'Count of Publication': p4Res.count }]);

        // Step 5: PubMed Target AND Cancer
        logInfo('[Workflow] Step 5: PubMed Target AND Cancer Count');
        const p5Res = await searchPubMedUtil(`${target} AND Cancer`, dateFrom10, dateTo, 1);
        addSheet(workbook, 'Step 5 - PubMed Tgt AND Cancer', [{ Query: `${target} AND Cancer`, 'Count of Publication': p5Res.count }]);

        // Step 6: PubMed Target AND metastasis
        logInfo('[Workflow] Step 6: PubMed Target AND metastasis Count');
        const p6Res = await searchPubMedUtil(`${target} AND metastasis`, dateFrom10, dateTo, 1);
        addSheet(workbook, 'Step 6 - PubMed Tgt AND metastasis', [{ Query: `${target} AND metastasis`, 'Count of Publication': p6Res.count }]);

        // Step 7: PubMed Target AND NOT Cancer
        logInfo('[Workflow] Step 7: PubMed Target AND NOT Cancer Count');
        const p7Res = await searchPubMedUtil(`${target} NOT Cancer`, dateFrom10, dateTo, 1);
        addSheet(workbook, 'Step 7 - PubMed Tgt NOT Cancer', [{ Query: `${target} NOT Cancer`, 'Count of Publication': p7Res.count }]);

        // Step 8: Clinical Trials Target Drug Name Phase and Year
        logInfo('[Workflow] Step 8: Clinical Trials Target details');
        const ct8Res = await fetchStudies({ keywords: [target], maxResults: 500 });
        const s8Data = ct8Res.formatted.map(r => ({
            'Target': target,
            'Drug Name': r.interventions,
            'Phase': r.phases,
            'Year': r.startDate ? String(r.startDate).substring(0, 4) : ''
        }));
        addSheet(workbook, 'Step 8 - CT Target Details', s8Data);

        // Step 9: PubMed Target AND Cancer AND Epidemiology (10 year, filtered for numeric data)
        logInfo('[Workflow] Step 9: PubMed Target AND Cancer AND Epidemiology');
        const p9Res = await searchPubMedUtil(`${target} AND Cancer AND Epidemiology`, dateFrom10, dateTo, 500);
        const s9Filtered = p9Res.results.filter(r => hasNumericData(r.Abstract));
        logInfo(`[Workflow] Step 9: ${p9Res.results.length} total articles → ${s9Filtered.length} with numeric epidemiology data`);
        const s9Data = s9Filtered.map(r => ({
            'Title': r.Title || 'N/A',
            'Epidemiology Data (Abstract)': r.Abstract || 'No abstract available',
            'Authors': r.Authors || 'N/A',
            'Publication Year': r['Publication Year'] || 'N/A',
            'PMID': r['DOI/PMID'] || 'N/A'
        }));
        addSheet(workbook, 'Step 9 - PubMed Epidemiology', s9Data);

        // Step 10: PubMed Target AND Cancer AND PREVALANCE (10 year, filtered for numeric data)
        logInfo('[Workflow] Step 10: PubMed Target AND Cancer AND PREVALANCE');
        const p10Res = await searchPubMedUtil(`${target} AND Cancer AND prevalence`, dateFrom10, dateTo, 500);
        const s10Filtered = p10Res.results.filter(r => hasNumericData(r.Abstract));
        logInfo(`[Workflow] Step 10: ${p10Res.results.length} total articles → ${s10Filtered.length} with numeric prevalence data`);
        const s10Data = s10Filtered.map(r => ({
            'Title': r.Title || 'N/A',
            'Prevalence Data (Abstract)': r.Abstract || 'No abstract available',
            'Authors': r.Authors || 'N/A',
            'Publication Year': r['Publication Year'] || 'N/A',
            'PMID': r['DOI/PMID'] || 'N/A'
        }));
        addSheet(workbook, 'Step 10 - PubMed Prevalence', s10Data);

        // Step 11: USPTO Target
        logInfo('[Workflow] Step 11: USPTO Target');
        const u11Res = await searchUsptoDsapi([target], 'AND', 100);
        if (u11Res.results && u11Res.results[0]) {
            logInfo(`[Workflow] USPTO Step 11 sample keys: ${Object.keys(u11Res.results[0]).join(', ')}`);
        }
        addSheet(workbook, 'Step 11 - USPTO Target', mapUspto(u11Res.results));

        // Step 12: USPTO TA
        logInfo('[Workflow] Step 12: USPTO Therapeutic Area');
        const u12Res = await searchUsptoDsapi([therapeuticArea], 'AND', 100);
        addSheet(workbook, 'Step 12 - USPTO TA', mapUspto(u12Res.results));

        // Step 13: USPTO Affiliation
        logInfo('[Workflow] Step 13: USPTO Affiliation');
        const u13Res = await searchUsptoDsapi([affiliation], 'AND', 100);
        addSheet(workbook, 'Step 13 - USPTO Affiliation', mapUspto(u13Res.results));

        // RUN PYTHON SCRIPTS
        logInfo('[Workflow] Running python scripts...');
        try {
            const scriptPath = path.resolve('../python_scripts/test.py');
            const pyDir = path.dirname(scriptPath);
            const pyEnv = path.join(pyDir, 'venv', 'bin', 'python3');
            let pythonCmd = 'python3';
            if (fs.existsSync(pyEnv)) {
                pythonCmd = pyEnv;
            }
            await execPromise(`${pythonCmd} ${scriptPath}`, { cwd: pyDir, timeout: 600000 }); // 10 minute timeout
            logInfo('[Workflow] Python script executed successfully.');

            // Load the generated MOA excel and add it to our workbook
            const moaPath = path.join(pyDir, 'Cancer_Drugs_MOA.xlsx');
            if (fs.existsSync(moaPath)) {
                const pWb = new ExcelJS.Workbook();
                await pWb.xlsx.readFile(moaPath);
                const pWbSheet = pWb.worksheets[0];

                const sheet = workbook.addWorksheet('Python Script - MOA Data');
                pWbSheet.eachRow((row, rowNumber) => {
                    sheet.addRow(row.values);
                });
                sheet.getRow(1).font = { bold: true };
            }
        } catch (err) {
            logError('[Workflow] Python script execution error', err);
            addSheet(workbook, 'Python Script Logs', [{ Error: err.message }]);
        }

        logInfo('[Workflow] Pipeline complete. Generating buffer...');
        return await workbook.xlsx.writeBuffer();
    } catch (error) {
        logError('[Workflow] Pipeline failed', error);
        throw error;
    }
}

function addSheet(workbook, sheetName, data) {
    const sheet = workbook.addWorksheet(sheetName.substring(0, 31)); // Excel limit is 31 chars
    if (!data || data.length === 0) {
        sheet.addRow(['No results found']);
        return;
    }

    // Sanitize all values: replace null/undefined/empty with 'N/A'
    const sanitized = data.map(row => {
        const clean = {};
        for (const [key, val] of Object.entries(row)) {
            if (val === null || val === undefined || val === '' || val === 'undefined') {
                clean[key] = 'N/A';
            } else {
                clean[key] = val;
            }
        }
        return clean;
    });

    const headers = Object.keys(sanitized[0]);
    sheet.columns = headers.map(h => ({ header: h, key: h, width: 25 }));

    sanitized.forEach(row => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true };
}

function mapUspto(docs) {
    if (!docs || !Array.isArray(docs)) return [];
    return docs.map(d => {
        // PatentsView returns standardized fields, DS-API returns cited* fields
        let patentNumber = d.patentNumber || d.citedDocumentNumber || d.citedDocumentUri || 'N/A';
        let title = d.title || d.citedInventionTitle || d.citedDocumentTitle || 'N/A';
        let abstract = d.abstract || d.citedAbstract || 'N/A';
        let assignee = d.assignee || d.inventors || d.citedAssignee || d.citedInventorName || 'N/A';
        let date = d.date || d.citedDocumentDate || d.publicationDate || 'N/A';

        if (Array.isArray(abstract)) abstract = abstract.join(' ');
        if (Array.isArray(title)) title = title.join(' ');
        if (Array.isArray(assignee)) assignee = assignee.join('; ');
        if (Array.isArray(patentNumber)) patentNumber = patentNumber[0];

        // Clean up undefined strings
        [patentNumber, title, abstract, assignee, date].forEach((v, i) => {
            if (!v || v === 'undefined') {
                if (i === 0) patentNumber = 'N/A';
                if (i === 1) title = 'N/A';
                if (i === 2) abstract = 'N/A';
                if (i === 3) assignee = 'N/A';
                if (i === 4) date = 'N/A';
            }
        });

        return {
            'Patent Number': patentNumber,
            'Title': title,
            'Abstract': abstract,
            'Assignee/Inventor': assignee,
            'Date': date
        };
    });
}

/**
 * Check if an abstract contains numeric epidemiology/prevalence data.
 * Looks for patterns like percentages, rates, counts, incidence numbers.
 */
function hasNumericData(abstract) {
    if (!abstract || typeof abstract !== 'string') return false;
    // Match patterns like: 45%, 12.3%, 1,234 patients, 0.5 per 100,000, CI 95%, HR 1.23, OR 2.5
    const numericPatterns = /\d+\.?\d*\s*%|\d{1,3}(,\d{3})+|\d+\.\d+\s*(per|\/|in)\s*\d|\b(incidence|prevalence|rate|mortality|survival|median|mean|CI|HR|OR|RR)\s*[:\s]*\d/i;
    return numericPatterns.test(abstract);
}
