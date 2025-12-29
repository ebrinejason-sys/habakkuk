# 🚀 Deployment Guide - Habakkuk Pharmacy POS

This guide will help you deploy your pharmacy POS system online and make it accessible at **habakkukpharmacy.com**.

---

## 📋 Pre-Deployment Checklist

Before deploying, ensure you have:
- [ ] GitHub account
- [ ] Vercel account (free tier works)
- [ ] Domain name (habakkukpharmacy.com)
- [ ] Resend account with verified domain
- [ ] Basic understanding of Git

---

## 🎯 Deployment Strategy Overview

```
Local Development → GitHub Repository → Vercel Deployment → Domain Configuration
```

---

## Step 1: Prepare Your Code for Production

### 1.1 Test Locally First

```powershell
# Ensure everything works locally
npm install
npm run db:setup
npm run dev
```

Visit http://localhost:3000 and test:
- ✅ Admin login
- ✅ Create a staff user (check if email sends)
- ✅ Process a POS transaction
- ✅ Bulk upload products
- ✅ View transactions

### 1.2 Create .gitignore (if not exists)

The project already has a `.gitignore` file, but ensure it includes:
```
node_modules/
.env
.env.local
.next/
prisma/*.db
prisma/*.db-journal
```

**⚠️ IMPORTANT**: Never commit `.env` file to Git!

---

## Step 2: Setup GitHub Repository

### 2.1 Create a New Repository

1. Go to https://github.com/new
2. Repository name: `habakkuk-pharmacy-pos`
3. Make it **Private** (recommended for business)
4. Don't initialize with README (we have one)
5. Click "Create repository"

### 2.2 Push Your Code to GitHub

```powershell
# Initialize git (if not already)
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: Habakkuk Pharmacy POS System"

# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/habakkuk-pharmacy-pos.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

## Step 3: Setup Production Database (PostgreSQL)

You have two options:

### Option A: Vercel Postgres (Recommended - Easiest)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Storage" → "Create Database"
3. Select "Postgres"
4. Choose a name: `habakkuk-pharmacy-db`
5. Select region (choose closest to your users)
6. Click "Create"
7. **Copy the connection string** (looks like: `postgresql://user:pass@host/db?sslmode=require`)

### Option B: Neon.tech (Free Tier Available)

1. Go to https://neon.tech
2. Sign up for free account
3. Create new project: "Habakkuk Pharmacy"
4. Copy the connection string from dashboard

### Option C: Railway.app

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Provision PostgreSQL"
4. Copy the connection string from "Connect" tab

**Save the connection string** - you'll need it in Step 5!

---

## Step 4: Configure Resend for Production

### 4.1 Verify Your Domain

For production emails to work properly:

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click "Add Domain"
3. Enter: `habakkukpharmacy.com`
4. Add the DNS records Resend provides to your domain registrar:
   ```
   Type: TXT
   Name: _resend
   Value: [provided by Resend]
   
   Type: MX
   Name: @
   Value: [provided by Resend]
   ```

5. Wait for verification (usually 5-30 minutes)
6. Once verified, you can send from `noreply@habakkukpharmacy.com`

### 4.2 Update Email Configuration

Your current email will change from test mode to:
```
From: noreply@habakkukpharmacy.com
```

---

## Step 5: Deploy to Vercel

### 5.1 Install Vercel CLI (Optional but Recommended)

```powershell
npm install -g vercel
```

### 5.2 Deploy Using Vercel Dashboard (Easiest)

1. Go to https://vercel.com/new
2. Click "Import Git Repository"
3. Select your GitHub repository: `habakkuk-pharmacy-pos`
4. **Configure Project**:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `.next` (auto-detected)
   
5. Click "Deploy" (it will fail first - that's expected because we need environment variables)

### 5.3 Add Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

| Name | Value | Notes |
|------|-------|-------|
| `DATABASE_URL` | `postgresql://...` | Your PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Generate new: `openssl rand -base64 32` | Run in terminal to generate |
| `NEXTAUTH_URL` | `https://habakkukpharmacy.com` | Your production domain |
| `RESEND_API_KEY` | `re_NDfnUUwV_JX5c21fLRnvxh9Eat6xvhrir` | Your existing Resend key |
| `RESEND_FROM_EMAIL` | `noreply@habakkukpharmacy.com` | After domain verification |

**To generate NEXTAUTH_SECRET on Windows:**
```powershell
# Option 1: Use Node
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 2: Use PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 5.4 Setup Production Database

After adding environment variables, you need to initialize the database:

**Option A: Using Vercel CLI**
```powershell
# Link to your Vercel project
vercel link

# Run Prisma commands
vercel env pull .env.production
npx prisma generate
npx prisma db push --skip-generate
npx prisma db seed
```

**Option B: Using Prisma Studio (Easier)**
1. In Vercel Dashboard, go to your project
2. Settings → Environment Variables
3. Copy `DATABASE_URL` value
4. On your local machine:
```powershell
# Create temporary .env.production file
echo "DATABASE_URL=your_production_database_url" > .env.production

# Initialize production database
npx dotenv -e .env.production -- npx prisma db push
npx dotenv -e .env.production -- npx prisma db seed
```

### 5.5 Redeploy

After adding environment variables:
1. Go to Deployments tab
2. Click "Redeploy" on the latest deployment
3. Wait for build to complete (2-3 minutes)

✅ Your app should now be live at: `https://your-project-name.vercel.app`

---

## Step 6: Configure Custom Domain (habakkukpharmacy.com)

### 6.1 Add Domain to Vercel

1. In Vercel Dashboard → Your Project → Settings → **Domains**
2. Click "Add"
3. Enter: `habakkukpharmacy.com`
4. Click "Add"
5. Also add: `www.habakkukpharmacy.com`

### 6.2 Configure DNS Settings

Vercel will show you DNS records to add. Go to your domain registrar (Namecheap, GoDaddy, etc.):

**For Root Domain (habakkukpharmacy.com):**
```
Type: A
Name: @
Value: 76.76.21.21
```

**For WWW Subdomain:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 6.3 Wait for DNS Propagation

- DNS changes take 5 minutes to 48 hours
- Usually works within 1-2 hours
- Check status at: https://www.whatsmydns.net

### 6.4 Enable HTTPS

Vercel automatically provides free SSL certificates via Let's Encrypt:
1. Once DNS is configured, Vercel auto-generates SSL
2. Your site will be accessible via `https://habakkukpharmacy.com`
3. HTTP requests automatically redirect to HTTPS

---

## Step 7: Post-Deployment Configuration

### 7.1 Update NEXTAUTH_URL

Once your domain is active:
1. Go to Vercel → Settings → Environment Variables
2. Update `NEXTAUTH_URL` to: `https://habakkukpharmacy.com`
3. Redeploy

### 7.2 Create Production Admin Account

Your seeded admin account should work, but to be safe:

1. Access: https://habakkukpharmacy.com
2. Login with: `admin@habakkukpharmacy.com` / `admin123`
3. Go to Settings → Update pharmacy information
4. Change admin password immediately

### 7.3 Test Email Functionality

1. Create a test staff user
2. Check if email arrives
3. If not, verify:
   - Resend domain is verified
   - `RESEND_FROM_EMAIL` matches verified domain
   - `RESEND_API_KEY` is correct

---

## Step 8: Security Hardening (Production)

### 8.1 Change Default Credentials

```
❌ DON'T use: admin123
✅ Use strong password: e.g., Hb@kk#2025!Pharm
```

### 8.2 Enable Vercel Authentication Protection (Optional)

For extra security during beta:
1. Vercel Dashboard → Settings → Deployment Protection
2. Enable "Password Protection"
3. Set a password

### 8.3 Setup Monitoring

Enable Vercel Analytics:
1. Dashboard → Analytics tab
2. Click "Enable Analytics"
3. Monitor traffic and performance

---

## Step 9: Ongoing Maintenance

### 9.1 Update Code

```powershell
# Make changes locally
git add .
git commit -m "Description of changes"
git push origin main
```

Vercel automatically deploys when you push to GitHub!

### 9.2 Database Backups

**For Vercel Postgres:**
- Automatic daily backups included
- Access via Vercel Dashboard → Storage → Backups

**For Other Providers:**
- Setup automated backups in their dashboard
- Export data weekly: `npx prisma db export`

### 9.3 Monitor Logs

View application logs:
1. Vercel Dashboard → Your Project
2. Click on any deployment
3. Click "Logs" tab
4. Monitor errors and issues

---

## 🎯 Quick Reference: URLs After Deployment

| Service | URL |
|---------|-----|
| **Production Site** | https://habakkukpharmacy.com |
| **Admin Login** | https://habakkukpharmacy.com/login |
| **Customer Portal** | https://habakkukpharmacy.com/customer/login |
| **Vercel Dashboard** | https://vercel.com/dashboard |
| **GitHub Repo** | https://github.com/YOUR_USERNAME/habakkuk-pharmacy-pos |
| **Database** | Via Vercel Storage or provider dashboard |
| **Email Dashboard** | https://resend.com/emails |

---

## 🔧 Troubleshooting Common Issues

### Issue: "Database connection failed"
**Solution:**
1. Check `DATABASE_URL` in Vercel environment variables
2. Ensure database is accessible from Vercel's IP ranges
3. Check SSL mode: connection string should end with `?sslmode=require`

### Issue: "Module not found" errors
**Solution:**
```powershell
# Ensure all dependencies are in package.json
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

### Issue: Emails not sending
**Solution:**
1. Verify Resend domain at https://resend.com/domains
2. Check `RESEND_FROM_EMAIL` matches verified domain
3. Check API key is correct
4. View logs in Resend dashboard

### Issue: "Authentication callback error"
**Solution:**
1. Verify `NEXTAUTH_URL` matches your actual domain
2. Check `NEXTAUTH_SECRET` is set
3. Ensure it's set for Production environment (not just Preview)

### Issue: Build failing on Vercel
**Solution:**
1. Check build logs in Vercel deployment
2. Ensure TypeScript has no errors: `npm run build` locally
3. Check all imports are correct case (file names)

### Issue: Slow page loads
**Solution:**
1. Enable Vercel Analytics to identify bottlenecks
2. Optimize database queries
3. Add indices to frequently queried fields in Prisma schema
4. Consider upgrading Vercel plan for better performance

---

## 💰 Cost Estimation

### Free Tier (Recommended for Start)
- ✅ Vercel: Free for hobby projects
- ✅ Vercel Postgres: Free tier (256MB)
- ✅ Resend: 100 emails/day free
- ✅ GitHub: Free for private repos

**Total: $0/month** (sufficient for small-medium pharmacy)

### Paid Tier (For Growth)
- Vercel Pro: $20/month
  - Better performance
  - Advanced analytics
  - Increased limits
- Vercel Postgres Pro: ~$10-50/month
  - More storage and connections
- Resend: $20/month
  - 50,000 emails/month

**Total: ~$50-90/month**

---

## 📞 Support Contacts

### Technical Issues
- Vercel Support: https://vercel.com/support
- Resend Support: https://resend.com/support
- GitHub Issues: Your repo → Issues tab

### Domain Issues
- Contact your domain registrar support

---

## ✅ Final Deployment Checklist

Before going live, verify:

- [ ] Code pushed to GitHub
- [ ] Vercel deployment successful (green checkmark)
- [ ] Production database initialized and seeded
- [ ] All environment variables set correctly
- [ ] Domain DNS configured and propagated
- [ ] HTTPS working (lock icon in browser)
- [ ] Admin login working
- [ ] Test staff user creation and email delivery
- [ ] POS transaction processing working
- [ ] Receipt generation working
- [ ] Customer portal accessible
- [ ] Mobile responsive (test on phone)
- [ ] Default admin password changed
- [ ] Pharmacy settings updated with real information
- [ ] Backup strategy in place

---

## 🎉 You're Live!

Once all checks pass:

1. ✅ Your pharmacy POS is online at **habakkukpharmacy.com**
2. ✅ Staff can access from any device with internet
3. ✅ Customers can browse and order online
4. ✅ Emails are being sent automatically
5. ✅ Data is secure and backed up

**Train your staff** on using the system and you're ready to go! 🚀

---

## 📚 Additional Resources

- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Prisma Deployment Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides)
- [DNS Propagation Checker](https://www.whatsmydns.net)

---

**Questions?** Review this guide step-by-step, and ensure each step is complete before moving to the next.

Good luck with your deployment! 🎊
