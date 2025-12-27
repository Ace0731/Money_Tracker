# Money Tracker - Complete User Guide

## 🚀 Getting Started

### First Time Setup

1. **Install Rust** (Required for Tauri)
   - Windows: Download from https://rustup.rs/
   - Run the installer and restart your terminal
   - Verify: `rustc --version`

2. **Run the App**
   ```bash
   cd G:\Projects\Money_Tracker
   npm run tauri dev
   ```
   
   **First run takes 5-10 minutes** as Rust compiles. Subsequent runs are instant!

3. **Build for Production**
   ```bash
   npm run tauri build
   ```
   Creates installer in `src-tauri/target/release/bundle/`

---

## 📊 Using the Application

### 1. Setting Up Your Accounts

**Go to: Accounts**

1. Click "Add Account"
2. Fill in:
   - Name (e.g., "HDFC Savings", "Cash Wallet")
   - Type (Bank/Cash/Investment)
   - Opening Balance (your current balance)
   - Notes (optional)
3. Click "Create"

**Tip:** Add all your banks, cash, and investment accounts first!

---

### 2. Creating Categories

**Go to: Categories**

Categories are grouped by type:
- **Income**: Salary, Freelance, Interest, etc.
- **Expense**: Groceries, Rent, Entertainment, etc.
- **Transfer**: Internal transfers between accounts

1. Click "Add Category"
2. Enter name and select type
3. Add optional notes

**Examples:**
- Income: Salary, Freelance Project, Dividends
- Expense: Groceries, Rent, Utilities, Shopping
- Transfer: ATM Withdrawal, Account Transfer

---

### 3. Managing Clients & Projects

**For Freelancers:**

**Clients:**
1. Go to Clients screen
2. Add client details and contact notes
3. Click any client card to edit

**Projects:**
1. Go to Projects screen
2. Create project and link to client
3. Set expected amount and dates
4. Track project earnings in transactions

---

### 4. Recording Transactions

**Go to: Transactions**

This is the heart of the app!

#### Adding a Transaction

1. Click "Add Transaction"
2. Select Direction:
   - **Income**: Money coming in → select "To Account"
   - **Expense**: Money going out → select "From Account"
   - **Transfer**: Moving between accounts → select both

3. Fill in:
   - Amount (in ₹)
   - Date
   - Account(s)
   - Category (filtered by direction)
   - Client/Project (optional, for freelance work)
   - Tags (optional, for custom organization)
   - Notes (optional)

4. Click "Create"

#### Filtering Transactions

Use the filter bar to:
- **Start/End Date**: View specific time period
- **Direction**: Filter by Income/Expense/Transfer
- **Click any row** to edit

---

## 💡 Pro Tips

### Transaction Organization

1. **Use Tags** for cross-category tracking:
   - "Business", "Personal", "Tax-Deductible"
   - "Urgent", "Recurring", "One-time"

2. **Add Notes** for important details:
   - Invoice numbers
   - Who you paid
   - What you bought

3. **Link to Projects** for freelance income:
   - Track which project earned what
   - See project-wise income

### Data Entry Best Practices

1. **Record Daily**: Don't let transactions pile up
2. **Be Specific**: Use descriptive category names
3. **Double Check**: Verify amounts and accounts
4. **Add Context**: Use notes field for future reference

---

## 🔒 Data & Privacy

### Your Data is 100% Local

- **No internet connection** required
- **No cloud storage** - everything stays on your PC
- **No tracking** or analytics
- **SQLite database** file: `money_tracker.db`

### Backing Up Your Data

**Manual Backup:**
1. Locate `money_tracker.db` in app directory
2. Copy to safe location (USB drive, another folder)

**To Restore:**
1. Close the app
2. Replace `money_tracker.db` with your backup
3. Restart the app

**Future:** Export/Import features coming soon!

---

## 📋 Keyboard Shortcuts

In Forms:
- `Tab` - Navigate between fields
- `Esc` - Close modal
- `Enter` - Submit form (when in last field)

---

## 🐛 Troubleshooting

### App Won't Start

1. **Check Rust Installation**
   ```bash
   rustc --version
   cargo --version
   ```

2. **Clean Build**
   ```bash
   cd src-tauri
   cargo clean
   cd ..
   npm run tauri dev
   ```

### Database Not Loading

1. Check if `money_tracker.db` exists
2. Try deleting it (will create fresh database)
3. Restart app

### UI Looks Broken

1. Clear browser cache (Ctrl+Shift+R in dev mode)
2. Restart dev server

---

## 🎯 What You Can Do Now

### ✅ Fully Functional

- ✅ Create and manage **Accounts**
- ✅ Organize with **Categories** (Income/Expense/Transfer)
- ✅ Track **Clients** and **Projects**
- ✅ Record all **Transactions** with full details
- ✅ Filter transactions by date and direction
- ✅ Tag transactions for organization
- ✅ Add notes to everything
- ✅ Edit any existing data (click to edit)

### 🚧 Coming Soon

- Dashboard with charts and summaries
- Advanced reports and analytics
- Export to CSV/JSON
- Import data
- Backup/restore features

---

## 💰 Example Workflow

### Typical Monthly Use

**Start of Month:**
1. Record opening balances (if first time)
2. Check all accounts are set up

**During Month:**
1. Add income when received
2. Record expenses as they happen
3. Link freelance income to projects
4. Use tags for organization

**End of Month:**
1. Review transactions in Transactions screen
2. Filter by date to see monthly view
3. Check category-wise spending (coming in Dashboard)

---

## 🎨 Understanding the UI

### Color Coding

- **Green** = Income / Positive
- **Red** = Expense / Negative
- **Blue** = Transfer / Client-related

### Icons & Badges

- Account type badges show Bank/Cash/Investment
- Direction badges color-coded by type
- Tags shown as small pills

---

## 🆘 Need Help?

### Where is my data stored?
`money_tracker.db` file in the app's working directory

### Can I use this on multiple computers?
Yes! Just copy the `.db` file between computers

### Is this secure?
Yes - all data is local, no internet access, no external services

### Can I delete transactions?
Not yet - you can edit them. (Delete feature coming soon)

---

## 🔄 Updates & Versions

**Current Version: v0.1**

This is the initial fully-functional version with:
- All data management screens
- Full CRUD operations
- Transaction tracking with filters
- Tag support
- Client/Project linking

**Next version will add:**
- Dashboard with charts (Recharts)
- Reports and analytics
- Export/Import
- Delete operations

---

## 📞 Quick Reference

| Task | Screen | Action |
|------|---------|--------|
| Add account | Accounts | Click "Add Account" |
| Create category | Categories | Click "Add Category" |
| Record expense | Transactions | Click "Add Transaction" → Expense |
| Record income | Transactions | Click "Add Transaction" → Income |
| Transfer money | Transactions | Click "Add Transaction" → Transfer |
| Edit anything | Any screen | Click on the item |
| Filter transactions | Transactions | Use filter bar at top |
| Add client | Clients | Click "Add Client" |
| Create project | Projects | Click "Add Project" → Select client |

---

**Enjoy tracking every rupee! 💰**
