const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
    action: { type: String, required: true }, // e.g., "Evidence Secured"
    target: { type: String, required: true }, // Name of Evidence/Case
    caseId: { type: String },
    type: { type: String, enum: ['Case', 'Evidence', 'Profile'], required: true },
    status: { type: String, enum: ['Created', 'Secured', 'Transferred', 'In Review', 'Updated', 'Archived', 'Active'], required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Log', LogSchema);
