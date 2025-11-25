import { appendToConsolidatedExcel } from './excelService.js';
import path from 'path';

/**
 * Saves search results to consolidated Excel file
 * This is called for all database searches to maintain one consolidated file
 * 
 * @param {Array} results - Search results
 * @param {string} source - Source database name
 */
export async function saveToConsolidatedExcel(results, source) {
    if (!results || results.length === 0) {
        return;
    }

    try {
        const consolidatedFile = path.resolve('consolidated_search_results.xlsx');
        await appendToConsolidatedExcel(consolidatedFile, results, source);
        console.log(`✅ Consolidated Excel updated: ${source} (${results.length} records)`);
    } catch (error) {
        console.error(`⚠️ Warning: Failed to save to consolidated Excel: ${error.message}`);
    }
}

