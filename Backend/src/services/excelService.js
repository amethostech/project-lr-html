import ExcelJS from 'exceljs';

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