# Habakkuk Pharmacy POS System

A comprehensive online Pharmacy Point of Sale system built with Next.js 15, TypeScript, Prisma, and Resend for email management.

## 🚀 Features

### Admin Features
- **Full System Control**: Complete access to all modules
- **User Management**: Create staff accounts with role-based permissions
- **Automated Email**: Send login credentials via Resend
- **Dashboard**: Real-time analytics and statistics
- **Settings**: Configure pharmacy information and receipt templates

### Inventory Management
- **Product Management**: Add, edit, and manage products
- **Stock Tracking**: Monitor stock levels with alerts
- **Bulk Upload**: Import products via CSV/Excel
- **Low Stock Alerts**: Automatic notifications
- **Stock Adjustments**: Track inventory changes

### POS (Point of Sale)
- **Fast Checkout**: Quick product search and selection
- **Multiple Payment Methods**: Cash, Card, Mobile Money
- **Receipt Generation**: Print formatted receipts
- **Real-time Stock Updates**: Automatic inventory adjustment

### Transactions & Reporting
- **Transaction History**: Complete sales records
- **Sales Analytics**: Daily, weekly, and monthly reports
- **Payment Tracking**: Monitor payment methods
- **Audit Logs**: Track all system activities

### Staff Portal
- **Role-Based Access**: Permissions based on assigned roles
- **Limited Access**: Staff can only access permitted modules
- **Password Management**: Force password change on first login

### Customer Portal
- **Customer Registration**: Self-service account creation
- **Product Browsing**: View available products
- **Online Ordering**: Place orders from inventory
- **Order Tracking**: Monitor order status

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

## 🛠️ Installation

### 1. Clone the repository
```bash
cd c:\Users\ebrin\habakkuk
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
The `.env` file is already configured with:
- Database: SQLite (development)
- Resend API Key: Your provided key
- NextAuth secret

### 4. Initialize the database
```bash
npx prisma generate
npx prisma db push
```

### 5. Seed the database
```bash
npx tsx prisma/seed.ts
```

This creates:
- Admin user: `admin@habakkukpharmacy.com` / `admin123`
- Default settings
- Sample products

### 6. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🔑 Default Login Credentials

### Admin Account
- **Email**: admin@habakkukpharmacy.com
- **Password**: admin123

## 📱 User Roles & Permissions

### Admin
- Full access to all features
- Can create and manage staff accounts
- Configure system settings

### Staff (Customizable Permissions)
- `MANAGE_USERS`: Create/edit users
- `MANAGE_SETTINGS`: Modify system settings
- `MANAGE_INVENTORY`: Add/edit products, adjust stock
- `VIEW_INVENTORY`: View products only
- `MANAGE_POS`: Process sales
- `VIEW_TRANSACTIONS`: View transaction history
- `MANAGE_TRANSACTIONS`: Manage transactions
- `VIEW_REPORTS`: Access reports

## 📧 Email Configuration (Resend)

Emails are automatically sent when:
- New staff accounts are created
- Users need password resets

The system uses your Resend API key: `re_NDfnUUwV_JX5c21fLRnvxh9Eat6xvhrir`

## 📊 Bulk Upload Format

For bulk product upload, use this CSV format:

```csv
name,sku,category,price,costPrice,quantity,reorderLevel,description
Paracetamol 500mg,PAR500,Pain Relief,5000,3000,100,20,Pain and fever relief
Ibuprofen 400mg,IBU400,Pain Relief,8000,5000,150,25,Anti-inflammatory
```

## 🚀 Deployment to Vercel

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Deploy
```bash
vercel
```

### 3. Configure Production Database
For production, replace SQLite with PostgreSQL:

1. Create a PostgreSQL database (e.g., on Vercel Postgres, Supabase, or Railway)
2. Update `.env` with production database URL:
```env
DATABASE_URL="postgresql://..."
```
3. Run migrations:
```bash
npx prisma db push
npx prisma generate
```

### 4. Set Environment Variables in Vercel
Add these to your Vercel project settings:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL` (your domain: https://habakkukpharmacy.com)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

## 🏗️ Project Structure

```
habakkuk/
├── app/
│   ├── admin/          # Admin dashboard & modules
│   │   ├── dashboard/  # Admin dashboard
│   │   ├── users/      # User management
│   │   ├── inventory/  # Inventory management
│   │   ├── pos/        # Point of sale
│   │   ├── transactions/ # Transaction history
│   │   └── settings/   # System settings
│   ├── staff/          # Staff portal
│   ├── customer/       # Customer portal
│   ├── api/            # API routes
│   └── login/          # Authentication pages
├── components/         # Reusable UI components
├── lib/                # Utilities and helpers
├── prisma/             # Database schema and migrations
└── public/             # Static assets
```

## 🔧 Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: Prisma ORM (SQLite/PostgreSQL)
- **Authentication**: NextAuth.js
- **Email**: Resend
- **UI**: Tailwind CSS + Radix UI
- **Deployment**: Vercel

## 📝 Key Features Implementation

### Authentication Flow
1. User logs in with email/password
2. System validates credentials
3. If first login, redirect to change password
4. Route to appropriate dashboard based on role

### User Creation Flow
1. Admin creates user with email and permissions
2. System generates random password
3. Email sent via Resend with credentials
4. User must change password on first login

### POS Transaction Flow
1. Staff searches and adds products to cart
2. System checks stock availability
3. Process payment with selected method
4. Generate and print receipt
5. Update inventory automatically
6. Create transaction record

### Bulk Upload Flow
1. Admin uploads CSV file
2. System parses and validates data
3. Check for duplicate SKUs
4. Create products in bulk
5. Return success count and errors

## 🐛 Troubleshooting

### Database Issues
```bash
# Reset database
npx prisma db push --force-reset
npx tsx prisma/seed.ts
```

### Email Not Sending
- Verify Resend API key is correct
- Check `RESEND_FROM_EMAIL` is properly configured
- Ensure domain is verified in Resend dashboard

### Authentication Errors
- Clear browser cookies
- Verify `NEXTAUTH_SECRET` is set
- Check `NEXTAUTH_URL` matches your domain

## 📈 Future Enhancements

- [ ] Advanced reporting and analytics
- [ ] Barcode scanning support
- [ ] Prescription management
- [ ] SMS notifications
- [ ] Multi-location support
- [ ] Advanced inventory forecasting
- [ ] Integration with payment gateways
- [ ] Mobile app (React Native)

## 📄 License

This project is proprietary software for Habakkuk Pharmacy.

## 👨‍💻 Support

For support, contact: admin@habakkukpharmacy.com

---

Built with ❤️ for Habakkuk Pharmacy
