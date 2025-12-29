# 🚀 Habakkuk Pharmacy POS - Quick Start Guide

Welcome! Follow these steps to get your pharmacy POS system up and running.

## ⚡ Quick Setup (3 Simple Steps)

### Step 1: Install Dependencies
```powershell
npm install
```

### Step 2: Setup Database
```powershell
npm run db:setup
```

This command will:
- Generate Prisma client
- Create the database
- Seed with initial data

### Step 3: Start the Application
```powershell
npm run dev
```

Open your browser to: **http://localhost:3000**

## 🔑 Login Credentials

### Admin Access
- **Email**: `admin@habakkukpharmacy.com`
- **Password**: `admin123`

## ✅ First Steps After Login

1. **Login as Admin** using credentials above
2. **Configure Settings** - Go to Settings and update:
   - Pharmacy Name
   - Location
   - Contact Information
   - Receipt Footer

3. **Create Staff User** - Go to Users:
   - Click "Create User"
   - Fill in details
   - Select permissions
   - User will receive email with login credentials

4. **Add Products**:
   - **Option 1**: Add manually via Inventory → Add Product
   - **Option 2**: Bulk upload via Inventory → Bulk Upload
     - Download the CSV template
     - Fill with your products
     - Upload the file

5. **Test POS** - Go to POS:
   - Search for products
   - Add to cart
   - Complete a test sale
   - Print receipt

## 📊 Sample Products Included

The system comes with 5 sample products:
- Paracetamol 500mg
- Ibuprofen 400mg
- Amoxicillin 250mg
- Vitamin C 1000mg
- Multivitamin Complex

## 🌐 Customer Portal

Customers can access the shop at: **http://localhost:3000/customer/login**

They can:
- Create accounts
- Browse products
- Place orders

## 📧 Email Configuration

Emails are configured with your Resend API key. When you create a user, they automatically receive:
- Login credentials
- Welcome message
- Instructions to change password

## 🆘 Common Issues & Solutions

### Database Error
```powershell
# Reset and recreate database
npm run db:setup
```

### Port Already in Use
```powershell
# The app runs on port 3000. If occupied, kill the process:
npx kill-port 3000
# Then run again:
npm run dev
```

### Module Not Found
```powershell
# Reinstall dependencies
rm -rf node_modules
npm install
```

## 📝 Available Commands

```powershell
npm run dev           # Start development server
npm run build         # Build for production
npm run start         # Start production server
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:seed       # Seed database with initial data
npm run db:setup      # Complete database setup (all in one)
```

## 🎯 Key Features to Explore

### For Admins:
- ✅ Dashboard - Overview of sales, inventory, users
- ✅ User Management - Create staff with custom permissions
- ✅ Inventory - Manage products, bulk upload
- ✅ POS - Process sales and print receipts
- ✅ Transactions - View sales history and reports
- ✅ Settings - Configure pharmacy details

### For Staff:
- ✅ Access only permitted modules
- ✅ Must change password on first login
- ✅ Can process sales if given POS permission
- ✅ Can manage inventory if given permission

## 🚀 Deploying to Vercel

1. **Install Vercel CLI**:
```powershell
npm i -g vercel
```

2. **Login to Vercel**:
```powershell
vercel login
```

3. **Deploy**:
```powershell
vercel
```

4. **Configure for Production**:
   - Set up PostgreSQL database (Vercel Postgres recommended)
   - Add environment variables in Vercel dashboard
   - Update `NEXTAUTH_URL` to your domain

## 📱 Testing Checklist

- [ ] Admin can login
- [ ] Admin can create staff user
- [ ] Staff receives email with credentials
- [ ] Staff can login and must change password
- [ ] Products can be added manually
- [ ] Products can be bulk uploaded
- [ ] POS can process sales
- [ ] Receipts are generated
- [ ] Inventory updates after sale
- [ ] Transaction history shows correctly
- [ ] Customer can register and browse products

## 💡 Pro Tips

1. **Backup Data**: Regularly backup your `prisma/dev.db` file
2. **Monitor Stock**: Check dashboard for low stock alerts
3. **Audit Logs**: Review audit logs for system activities
4. **Email Testing**: Test user creation to verify emails work
5. **Bulk Upload**: Use Excel → Save As CSV for bulk uploads

## 📞 Need Help?

- Check `README.md` for detailed documentation
- Review error messages in the console
- Ensure all environment variables are set

---

🎉 **You're all set!** Start managing your pharmacy with ease.

For production deployment questions or custom features, contact support.
