import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { parse } from 'fast-csv';

// Determine where the news CSV should be read from.
// In production you should set one of:
//   - NEWS_CSV_URL  → e.g. https://your-bucket.s3.amazonaws.com/merged_articles_cleaned.csv
//   - or NEWS_CSV_PATH → absolute/relative path on disk (for local dev or mounted storage)
const CSV_SOURCE = process.env.NEWS_CSV_URL || process.env.NEWS_CSV_PATH;

/**
 * Create a readable stream for the news CSV, either from local disk or from
 * a remote HTTP(S) URL (for example an S3 object or other HTTP‑served file).
 */
async function createCsvReadStream() {
    if (!CSV_SOURCE) {
        throw new Error(
            'NEWS_CSV_URL or NEWS_CSV_PATH is not set. Configure it to point to your news CSV (e.g. S3 URL or local path).'
        );
    }

    // HTTP / HTTPS source (e.g. S3 or other object storage)
    if (/^https?:\/\//i.test(CSV_SOURCE)) {
        const response = await fetch(CSV_SOURCE);
        if (!response.ok) {
            throw new Error(`Failed to download news CSV from ${CSV_SOURCE}: ${response.status} ${response.statusText}`);
        }
        if (!response.body) {
            throw new Error(`Received empty response body when downloading news CSV from ${CSV_SOURCE}`);
        }
        return response.body; // Node.js readable stream
    }

    // Local file path
    const filePath = path.isAbsolute(CSV_SOURCE) ? CSV_SOURCE : path.resolve(CSV_SOURCE);

    if (!fs.existsSync(filePath)) {
        throw new Error(`News CSV file not found at path: ${filePath}`);
    }

    return fs.createReadStream(filePath);
}

/**
 * Read and filter news articles from the CSV based on keywords.
 *
 * @param {Array<string>} keywords   Array of free‑text keywords
 * @param {number}        maxResults Maximum number of rows to return
 * @returns {Promise<Array<object>>}
 */
export async function searchNewsArticles(keywords, maxResults = 100) {
    if (!Array.isArray(keywords) || keywords.length === 0) {
        return [];
    }

    const normalizedKeywords = keywords
        .map(k => String(k ?? '').toLowerCase().trim())
        .filter(k => k.length > 0);

    if (normalizedKeywords.length === 0) {
        return [];
    }

    const limit = Math.min(Math.max(parseInt(maxResults ?? '1', 10) || 1, 1), 10000);
    const results = [];

    const stream = await createCsvReadStream();

    return new Promise((resolve, reject) => {
        const csvStream = parse({ headers: true })
            .on('error', (err) => {
                console.error('[NewsArticlesService] CSV parse error:', err);
                reject(err);
            })
            .on('data', (row) => {
                try {
                    // Expect headers: Amethos Id,Date,Source,News link,Headline,Body/abstract/extract,Cloud strategiesCleaned_Text_G,QC_H
                    const headline = String(row['Headline'] || '').toLowerCase();
                    const body = String(row['Body/abstract/extract'] || '').toLowerCase();
                    const cleaned = String(row['Cleaned_Text_G'] || '').toLowerCase();
                    const source = String(row['Source'] || '').toLowerCase();

                    const haystack = `${headline} ${body} ${cleaned} ${source}`;
                    const isMatch = normalizedKeywords.some((kw) => kw && haystack.includes(kw));
                    if (!isMatch) return;

                    const article = {
                        'Amethos Id': row['Amethos Id'] || '',
                        'Date': row['Date'] || '',
                        'Source': row['Source'] || '',
                        'News link': row['News link'] || '',
                        'Headline': row['Headline'] || '',
                        'Body/abstract/extract': row['Body/abstract/extract'] || '',
                        'Cleaned_Text_G': row['Cleaned_Text_G'] || '',
                        'QC_H': row['QC_H'] || ''
                    };

                    results.push(article);

                    // Stop early if we've reached the limit
                    if (results.length >= limit) {
                        if (typeof stream.destroy === 'function') {
                            stream.destroy();
                        }
                        csvStream.destroy();
                        return;
                    }
                } catch (err) {
                    console.error('[NewsArticlesService] Error processing CSV row:', err);
                    // continue with next row
                }
            })
            .on('end', () => {
                resolve(results);
            });

        stream.pipe(csvStream);
    });
}

/**
 * Return basic information about the configured CSV source.
 * This is useful for health checks or a /api/news/status endpoint.
 */
export async function getNewsSourceStatus() {
    if (!CSV_SOURCE) {
        return {
            configured: false,
            message: 'NEWS_CSV_URL or NEWS_CSV_PATH is not configured.'
        };
    }

    // Remote HTTP(S) source
    if (/^https?:\/\//i.test(CSV_SOURCE)) {
        try {
            const resp = await fetch(CSV_SOURCE, { method: 'HEAD' });
            if (!resp.ok) {
                return {
                    configured: true,
                    type: 'url',
                    url: CSV_SOURCE,
                    reachable: false,
                    status: resp.status,
                    statusText: resp.statusText
                };
            }

            const contentLength = resp.headers.get('content-length');
            const lastModified = resp.headers.get('last-modified') || undefined;

            return {
                configured: true,
                type: 'url',
                url: CSV_SOURCE,
                reachable: true,
                size: contentLength ? Number(contentLength) : undefined,
                lastModified
            };
        } catch (err) {
            return {
                configured: true,
                type: 'url',
                url: CSV_SOURCE,
                reachable: false,
                error: err.message
            };
        }
    }

    // Local file path
    const filePath = path.isAbsolute(CSV_SOURCE) ? CSV_SOURCE : path.resolve(CSV_SOURCE);
    try {
        const stats = fs.statSync(filePath);
        return {
            configured: true,
            type: 'file',
            path: filePath,
            exists: true,
            size: stats.size,
            modifiedAt: stats.mtime.toISOString()
        };
    } catch (err) {
        return {
        configured: true,
        type: 'file',
        path: filePath,
        exists: false,
        error: err.message
        };
    }
}


