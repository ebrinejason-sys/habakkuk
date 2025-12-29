# 🚀 Quick Start Guide - Setup Database

You have two options for the database:

## Option 1: Use Free Online PostgreSQL (Easiest - Recommended)

### Using Neon.tech (Free Forever Tier)

1. **Go to** https://neon.tech
2. **Sign up** with GitHub or email
3. **Create a new project**: `habakkuk-pharmacy`
4. **Copy the connection string** (looks like):
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/habakkuk_pharmacy?sslmode=require
   ```

5. **Update your `.env` file**:
   ```env
   DATABASE_URL="postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/habakkuk_pharmacy?sslmode=require"
   ```

6. **Setup database**:
   ```powershell
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

7. **Start the app**:
   ```powershell
   npm run dev
   ```

### Using Supabase (Alternative)

1. **Go to** https://supabase.com
2. **Sign up** and create new project: `habakkuk-pharmacy`
3. **Get connection string** from Settings → Database
4. **Use "Connection Pooling" string** (better for serverless)
5. **Update `.env`** and run setup commands above

### Using Railway.app (Alternative)

1. **Go to** https://railway.app
2. **Sign up** with GitHub
3. **New Project** → **Provision PostgreSQL**
4. **Copy connection string** from Connect tab
5. **Update `.env`** and run setup commands above

---

## Option 2: Install PostgreSQL Locally (For Advanced Users)

### Windows Installation

1. **Download PostgreSQL** from: https://www.postgresql.org/download/windows/
2. **Run installer** (use default settings)
3. **Set password** for postgres user (remember this!)
4. **Complete installation**

5. **Create database**:
   ```powershell
   # Open PowerShell as Administrator
   psql -U postgres
   # Enter your password when prompted
   
   # In psql:
   CREATE DATABASE habakkuk_pharmacy;
   \q
   ```

6. **Update `.env`**:
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/habakkuk_pharmacy"
   ```

7. **Setup database**:
   ```powershell
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   npm run dev
   ```

---

## ✅ Recommended: Use Neon.tech

**Why?**
- ✅ Free forever (no credit card)
- ✅ No installation needed
- ✅ Same database for dev and production
- ✅ Automatic backups
- ✅ Works immediately
- ✅ 512 MB storage free tier

**Time to setup: 5 minutes**

---

## 🎯 Next Steps

After setting up database:

1. ✅ Update `.env` with your connection string
2. ✅ Run `npx prisma generate`
3. ✅ Run `npx prisma db push`
4. ✅ Run `npx prisma db seed`
5. ✅ Run `npm run dev`
6. ✅ Visit http://localhost:3000
7. ✅ Login with: admin@habakkukpharmacy.com / admin123

Then you're ready to push to GitHub and deploy to Vercel!
