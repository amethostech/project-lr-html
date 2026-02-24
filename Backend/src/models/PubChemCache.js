import mongoose from 'mongoose';

/**
 * PubChem cache schema
 * Stores results from PubChem searches to avoid repeated expensive API calls
 */
const pubchemCacheSchema = new mongoose.Schema(
    {
        // Search parameters (used as cache key)
        molecule: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true
        },
        bioassayFilter: {
            type: String,
            default: "Any",
            index: true
        },
        targetClass: {
            type: String,
            default: "",
            index: true
        },
        maxResults: {
            type: Number,
            default: 100,
            index: true
        },

        // Cached data
        cid: {
            type: Number,
            index: true
        },
        iupacName: String,
        smiles: String,
        totalAIDsFound: Number,

        // Result records
        results: [
            {
                'Molecule Name': String,
                'CID': Number,
                'SMILES': String,
                'Molecular Weight': String,
                'Molecular Formula': String,
                'AID': Number,
                'Assay Name': String,
                'Assay Type': String,
                'Category': String,
                'Target Class': String,
                'Source': { type: String, default: 'PubChem' }
            }
        ],

        // Metadata
        resultCount: {
            type: Number,
            default: 0,
            index: true
        },
        searchDuration: {
            type: Number, // milliseconds
            default: 0
        },
        fetchedAt: {
            type: Date,
            default: Date.now,
            index: true,
            expires: 30 * 24 * 60 * 60 // Auto-delete after 30 days
        }
    },
    { timestamps: true }
);

// Compound index for cache lookups
pubchemCacheSchema.index({
    molecule: 1,
    bioassayFilter: 1,
    targetClass: 1,
    maxResults: 1
});

// Export model
const PubChemCache = mongoose.model('PubChemCache', pubchemCacheSchema);
export default PubChemCache;
