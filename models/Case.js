const mongoose = require('mongoose');

const CaseSchema = new mongoose.Schema({
    caseId: { type: String, required: true, unique: true }, // Format: CASE-882
    title: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Archived'], default: 'Active' },
    investigator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    integrity: { type: String, default: '100%' },
    logTime: { type: String, default: 'Just now' }
}, { timestamps: true });

module.exports = mongoose.model('Case', CaseSchema);
