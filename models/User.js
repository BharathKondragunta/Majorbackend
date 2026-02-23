const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'officer' },
    clearance: { type: String, default: 'Level 1' },
    avatar: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
