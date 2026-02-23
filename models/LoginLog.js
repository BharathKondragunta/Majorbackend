const mongoose = require('mongoose');

const LoginLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true },
    ip: { type: String },
    device: { type: String },
    status: { type: String, enum: ['Success', 'Failed'], default: 'Success' },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LoginLog', LoginLogSchema);
