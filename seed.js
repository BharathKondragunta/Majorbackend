const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const mongoURI = process.env.mongo_db_url;

async function seedAdmin() {
    try {
        await mongoose.connect(mongoURI);
        console.log('✅ Connected to MongoDB');

        const existingUser = await User.findOne({ email: 'admin@chainguard.agency' });
        if (existingUser) {
            console.log('ℹ️ Admin user already exists');
        } else {
            const hashedPassword = await bcrypt.hash('password123', 10);
            const admin = new User({
                username: 'Admin',
                email: 'admin@chainguard.agency',
                password: hashedPassword,
                clearance: 'Level 4 Clearance',
                role: 'admin',
                avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'
            });

            await admin.save();
            console.log('✅ Admin user created successfully!');
        }
    } catch (error) {
        console.error('❌ Seeding error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

seedAdmin();
