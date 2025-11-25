import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

/**
 * Generates an Excel buffer from an array of search results.
 */
export async function generateExcelBuffer(results) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('PubMed Results');

    // Get all unique keys from results
    const allKeys = results.length > 0 ? Object.keys(results[0]) : [];
    
    // Define columns
    worksheet.columns = allKeys.map(key => ({
        header: key,
        key: key,
        width: 20
    }));

    // Add rows
    results.forEach(result => {
        worksheet.addRow(result);
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
    };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

/**
 * Appends results to an existing Excel file or creates a new one.
 * Similar to the Python append_to_excel_file function.
 * 
 * @param {string} filename - Path to the Excel file
 * @param {Array} results - List of dictionaries containing search results to append
 * @param {string} sheetName - Name of the worksheet (default: 'uspto responses')
 */
export async function appendToExcelFile(filename, results, sheetName = 'uspto responses') {
    if (!results || results.length === 0) {
        return;
    }

    const filePath = path.resolve(filename);
    const fileExists = fs.existsSync(filePath);

    let workbook;
    let worksheet;

    if (fileExists) {
        // Load existing workbook
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        // Get or create the sheet
        if (workbook.getWorksheet(sheetName)) {
            worksheet = workbook.getWorksheet(sheetName);
        } else {
            worksheet = workbook.addWorksheet(sheetName);
        }

        // Get existing headers from first row
        const existingHeaders = [];
        if (worksheet.rowCount > 0) {
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell({ includeEmpty: false }, (cell) => {
                existingHeaders.push(cell.value);
            });
        }

        // Get all unique keys from new results
        const allKeysFromResults = new Set();
        results.forEach(result => {
            Object.keys(result).forEach(key => allKeysFromResults.add(key));
        });

        // Merge headers: existing + new columns
        const newHeaders = Array.from(allKeysFromResults).filter(k => !existingHeaders.includes(k));
        const allHeaders = [...existingHeaders, ...newHeaders];

        // Update header row if new columns were added
        if (newHeaders.length > 0) {
            // Update existing header cells styling
            existingHeaders.forEach((header, idx) => {
                const cell = worksheet.getCell(1, idx + 1);
                cell.value = header;
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD3D3D3' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'center' };
                worksheet.getColumn(idx + 1).width = 20;
            });

            // Add new header columns
            const startCol = existingHeaders.length + 1;
            newHeaders.forEach((header, idx) => {
                const colIdx = startCol + idx;
                const cell = worksheet.getCell(1, colIdx);
                cell.value = header;
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD3D3D3' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'center' };
                worksheet.getColumn(colIdx).width = 20;
            });
        }

        // Append data rows
        results.forEach(result => {
            const row = allHeaders.map(header => {
                const value = result[header] || '';
                // Convert complex types to strings for Excel compatibility
                if (value !== null && value !== undefined && typeof value !== 'string' && typeof value !== 'number') {
                    return String(value);
                }
                return value;
            });
            worksheet.addRow(row);
        });
    } else {
        // Create new workbook
        workbook = new ExcelJS.Workbook();
        worksheet = workbook.addWorksheet(sheetName);

        // Get all unique keys from results
        const allKeys = results.length > 0 ? Object.keys(results[0]) : [];

        // Add header row
        worksheet.columns = allKeys.map(key => ({
            header: key,
            key: key,
            width: 20
        }));

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };
        worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };

        // Add data rows
        results.forEach(result => {
            const row = allKeys.map(key => {
                const value = result[key] || '';
                // Convert complex types to strings for Excel compatibility
                if (value !== null && value !== undefined && typeof value !== 'string' && typeof value !== 'number') {
                    return String(value);
                }
                return value;
            });
            worksheet.addRow(row);
        });
    }

    // Save workbook
    await workbook.xlsx.writeFile(filePath);
}

/**
 * Appends results to a consolidated Excel file with Source column
 * All database results go into the same file/sheet
 * 
 * @param {string} filename - Path to the Excel file
 * @param {Array} results - List of dictionaries containing search results
 * @param {string} source - Source database name (e.g., 'USPTO', 'PubMed', 'Google Scholar')
 */
export async function appendToConsolidatedExcel(filename, results, source = 'Unknown') {
    if (!results || results.length === 0) {
        return;
    }

    const filePath = path.resolve(filename);
    const fileExists = fs.existsSync(filePath);

    let workbook;
    let worksheet;
    const sheetName = 'Consolidated Results';

    // Add Source column to each result
    const resultsWithSource = results.map(result => ({
        ...result,
        'Source Database': source,
        'Search Date': new Date().toISOString().split('T')[0] // Add date
    }));

    if (fileExists) {
        // Load existing workbook
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        
        // Get or create the consolidated sheet
        if (workbook.getWorksheet(sheetName)) {
            worksheet = workbook.getWorksheet(sheetName);
        } else {
            worksheet = workbook.addWorksheet(sheetName);
        }

        // Get existing headers from first row
        const existingHeaders = [];
        if (worksheet.rowCount > 0) {
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell({ includeEmpty: false }, (cell) => {
                existingHeaders.push(cell.value);
            });
        }

        // Get all unique keys from new results
        const allKeysFromResults = new Set();
        resultsWithSource.forEach(result => {
            Object.keys(result).forEach(key => allKeysFromResults.add(key));
        });

        // Merge headers: existing + new columns
        const newHeaders = Array.from(allKeysFromResults).filter(k => !existingHeaders.includes(k));
        const allHeaders = [...existingHeaders, ...newHeaders];

        // Update header row if new columns were added
        if (newHeaders.length > 0) {
            // Update existing header cells styling
            existingHeaders.forEach((header, idx) => {
                const cell = worksheet.getCell(1, idx + 1);
                cell.value = header;
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD3D3D3' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'center' };
                worksheet.getColumn(idx + 1).width = 20;
            });

            // Add new header columns
            const startCol = existingHeaders.length + 1;
            newHeaders.forEach((header, idx) => {
                const colIdx = startCol + idx;
                const cell = worksheet.getCell(1, colIdx);
                cell.value = header;
                cell.font = { bold: true };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD3D3D3' }
                };
                cell.alignment = { horizontal: 'center', vertical: 'center' };
                worksheet.getColumn(colIdx).width = 20;
            });
        }

        // Append data rows
        resultsWithSource.forEach(result => {
            const row = allHeaders.map(header => {
                const value = result[header] || '';
                // Convert complex types to strings for Excel compatibility
                if (value !== null && value !== undefined && typeof value !== 'string' && typeof value !== 'number') {
                    return String(value);
                }
                return value;
            });
            worksheet.addRow(row);
        });
    } else {
        // Create new workbook
        workbook = new ExcelJS.Workbook();
        worksheet = workbook.addWorksheet(sheetName);

        // Get all unique keys from results
        const allKeys = resultsWithSource.length > 0 ? Object.keys(resultsWithSource[0]) : [];

        // Add header row
        worksheet.columns = allKeys.map(key => ({
            header: key,
            key: key,
            width: 20
        }));

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };
        worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'center' };

        // Add data rows
        resultsWithSource.forEach(result => {
            const row = allKeys.map(key => {
                const value = result[key] || '';
                // Convert complex types to strings for Excel compatibility
                if (value !== null && value !== undefined && typeof value !== 'string' && typeof value !== 'number') {
                    return String(value);
                }
                return value;
            });
            worksheet.addRow(row);
        });
    }

    // Save workbook
    await workbook.xlsx.writeFile(filePath);
}