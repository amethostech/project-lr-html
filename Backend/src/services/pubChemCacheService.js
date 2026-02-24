import PubChemCache from '../models/PubChemCache.js';

/**
 * PubChem Caching Service
 * Prevents repeated expensive API calls for the same searches
 */

/**
 * Normalize search parameters for cache key
 */
function normalizeCacheKey(molecule, bioassayFilter, targetClass, maxResults) {
    return {
        molecule: molecule.toLowerCase().trim(),
        bioassayFilter: (bioassayFilter || "Any").trim(),
        targetClass: (targetClass || "").toLowerCase().trim(),
        maxResults: Math.min(maxResults, 200) // Cap at 200
    };
}

/**
 * Try to get results from cache
 * @returns {Promise<Array|null>} Cached results or null if not found/expired
 */
export async function getCachedResults(molecule, bioassayFilter = "Any", targetClass = "", maxResults = 100) {
    try {
        const cacheKey = normalizeCacheKey(molecule, bioassayFilter, targetClass, maxResults);
        
        const cached = await PubChemCache.findOne(cacheKey).lean();
        
        if (cached && cached.results && cached.results.length > 0) {
            const age = Date.now() - new Date(cached.fetchedAt).getTime();
            const ageHours = (age / (1000 * 60 * 60)).toFixed(1);
            
            console.log(`[PubChem Cache] ✓ HIT: Found ${cached.results.length} cached results (${ageHours}h old)`);
            return cached.results;
        } else if (cached) {
            console.log(`[PubChem Cache] ✓ HIT: Empty result cached`);
            return [];
        }
        
        console.log(`[PubChem Cache] ✗ MISS: No cached results for "${molecule}"`);
        return null;
    } catch (error) {
        console.error(`[PubChem Cache] Error reading cache: ${error.message}`);
        return null; // Fail gracefully, proceed with API call
    }
}

/**
 * Store results in cache for future use
 */
export async function cacheResults(
    molecule,
    bioassayFilter = "Any",
    targetClass = "",
    maxResults = 100,
    results = [],
    metadata = {}
) {
    try {
        const cacheKey = normalizeCacheKey(molecule, bioassayFilter, targetClass, maxResults);
        
        // Extract compound metadata if available
        const compoundData = {
            cid: metadata.cid,
            iupacName: metadata.iupacName,
            smiles: metadata.smiles,
            totalAIDsFound: metadata.totalAIDsFound,
            searchDuration: metadata.searchDuration || 0
        };
        
        // Update or insert cache entry
        const cached = await PubChemCache.findOneAndUpdate(
            cacheKey,
            {
                ...cacheKey,
                ...compoundData,
                results: results.slice(0, maxResults), // Only cache up to maxResults
                resultCount: results.length,
                fetchedAt: new Date()
            },
            { upsert: true, new: true }
        );
        
        console.log(`[PubChem Cache] ✓ SAVE: Cached ${results.length} results for "${molecule}"`);
        return cached;
    } catch (error) {
        console.error(`[PubChem Cache] Error saving cache: ${error.message}`);
        // Fail gracefully - caching is optional
    }
}

/**
 * Clear cache for a specific molecule or entire cache
 */
export async function clearCache(molecule = null) {
    try {
        if (molecule) {
            const result = await PubChemCache.deleteMany({
                molecule: molecule.toLowerCase().trim()
            });
            console.log(`[PubChem Cache] ✓ CLEAR: Deleted ${result.deletedCount} cache entries for "${molecule}"`);
        } else {
            const result = await PubChemCache.deleteMany({});
            console.log(`[PubChem Cache] ✓ CLEAR: Deleted entire cache (${result.deletedCount} entries)`);
        }
    } catch (error) {
        console.error(`[PubChem Cache] Error clearing cache: ${error.message}`);
    }
}

/**
 * Get cache statistics
 */
export async function getCacheStats() {
    try {
        const total = await PubChemCache.countDocuments({});
        const totalResults = await PubChemCache.aggregate([
            { $group: { _id: null, totalResults: { $sum: '$resultCount' } } }
        ]);
        
        const stats = {
            cacheEntries: total,
            totalResults: totalResults[0]?.totalResults || 0,
            avgResultsPerEntry: total > 0 ? Math.round(totalResults[0]?.totalResults / total) : 0
        };
        
        console.log(`[PubChem Cache] Stats: ${JSON.stringify(stats)}`);
        return stats;
    } catch (error) {
        console.error(`[PubChem Cache] Error getting stats: ${error.message}`);
        return null;
    }
}
