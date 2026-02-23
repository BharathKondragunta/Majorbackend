const mongoose = require('mongoose');

const EvidenceSchema = new mongoose.Schema({
    evidenceId: { type: String, required: true, unique: true }, // Format: EV-001
    caseId: { type: String, required: true }, // Using String ID for now to match frontend logic, but could be ObjectId
    title: { type: String, required: true },
    type: { type: String, enum: ['Image', 'Video', 'Document', 'Audio', 'Physical', 'Other'], required: true },
    size: { type: String },
    location: { type: String },
    hashSHA256: { type: String, required: true },
    hashMD5: { type: String },
    fileName: { type: String },
    filePath: { type: String },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    currentCustodian: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    metadata: {
        deviceInfo: String,
        gpsCoordinates: String,
        timestamp: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Evidence', EvidenceSchema);
