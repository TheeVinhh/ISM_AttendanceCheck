import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../src/models/User';

async function createAdminAccount() {
  try {
    await mongoose.connect(process.env['MONGO_URI']!);
    console.log('✅ MongoDB connected');

    const email = 'admin@company.com';
    const password = 'Admin@12345'; // Change this to a secure password
    const fullName = 'Admin User';

    // Check if admin already exists
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`❌ Admin account with email "${email}" already exists`);
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin
    const admin = await User.create({
      fullName,
      email,
      passwordHash,
      role: 'admin',
      authProvider: 'local',
    });

    console.log('✅ Admin account created successfully!');
    console.log(`📧 Email: ${email}`);
    console.log(`🔐 Password: ${password}`);
    console.log(`👤 Name: ${fullName}`);
    console.log(`🆔 ID: ${admin._id}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating admin:', err);
    process.exit(1);
  }
}

createAdminAccount();
