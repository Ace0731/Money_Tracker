# 💰 Money Tracker

A powerful, **100% local** personal finance tracker for freelancers and individuals. Built with React, Tauri, and SQLite.

![Version](https://img.shields.io/badge/version-1.7.0-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-Private-red)

---

## ✨ Features

### 💵 Transaction Management
- Track income, expenses, and transfers
- Multi-account support (Bank, Cash, Credit, Investment)
- Multi-tag support for detailed categorization
- Recurring transactions
- CSV/JSON import & export

### 📊 Reports & Analytics
- Interactive dashboards with charts
- Monthly/yearly summaries
- Category-wise spending breakdown
- Account balance tracking
- Client & project profitability reports

### 👥 Freelance Management
- **Clients** with status tracking (🟢 Active | 🎯 Prospect | 💤 Inactive)
- **Projects** with status (🟢 Active | ⏸️ On Hold | 🎯 Prospect | ✅ Completed | ❌ Cancelled)
- Link transactions to clients & projects
- Track project-wise income

### 📈 Investment Portfolio
Track your investments with smart calculations:

| Type | Features |
|------|----------|
| **Stocks & MF** | Live price sync, lot tracking, P&L |
| **Fixed Deposit** | Compound interest calculator |
| **Recurring Deposit** | Monthly deposit tracking |
| **PPF** | 7.1% annual, maturity countdown |
| **NPS** | Live NAV fetch from npsnav.in |

### 🏷️ Organization
- Customizable categories with icons
- Unlimited tags per transaction
- Notes and attachments support
- Search & filter everything

### 🔒 Privacy First
- **100% Local** - No cloud, no internet required
- SQLite database stored on your machine
- Full data export (CSV, JSON, DB backup)
- No telemetry, no tracking

---

## 🖥️ Screenshots

<details>
<summary>Click to view screenshots</summary>

*Screenshots coming soon*

</details>

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Desktop | Tauri 2.0 (Rust) |
| Database | SQLite |
| Charts | Recharts |
| State | Zustand |

---

## 📦 Installation

### Prerequisites
- Node.js v18+
- Rust (latest stable)
- npm or yarn

### Development
```bash
# Clone the repository
git clone https://github.com/yourusername/money-tracker.git

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Production Build
```bash
# Generates both .msi and .exe installers
npm run tauri build
```

The installers will be created in `src-tauri/target/release/bundle/`. 
- **EXE:** `bundle/nsis/*.exe` (Standard lightweight installer)
- **MSI:** `bundle/msi/*.msi` (Windows Installer package)

---

## 📁 Project Structure

```
money-tracker/
├── src/                        # React frontend
│   ├── components/             # Reusable UI components
│   ├── screens/                # Main application screens
│   ├── hooks/                  # Custom React hooks
│   ├── store/                  # Zustand state management
│   ├── utils/                  # Utilities & helpers
│   │   ├── formatters.ts       # Currency/date formatting
│   │   ├── theme.ts            # Dark theme styles
│   │   └── investmentCalculations.ts  # FD/RD/PPF/NPS formulas
│   └── types/                  # TypeScript interfaces
├── src-tauri/                  # Tauri backend (Rust)
│   └── src/
│       ├── commands/           # Tauri IPC commands
│       │   ├── transactions.rs
│       │   ├── accounts.rs
│       │   ├── investments.rs
│       │   ├── clients.rs
│       │   └── projects.rs
│       └── db/                 # Database migrations
└── public/                     # Static assets
```

---

## � Backup & Restore

Your data is stored in `money_tracker.db` in the application data directory.

### Simple Backup
1. Close the Money Tracker app.
2. Locate the database file (usually in the app's root or `%APPDATA%/com.moneytracker.app/`).
3. Copy `money_tracker.db` to a safe location.

### Restore
1. Close the app.
2. Replace the existing `money_tracker.db` with your backup.
3. Restart the app.

---

| Table | Description |
|-------|-------------|
| `accounts` | Bank, cash, credit, investment accounts |
| `categories` | Income/expense categories with icons |
| `transactions` | All money movements |
| `investments` | FD, RD, PPF, NPS, stocks, mutual funds |
| `investment_lots` | Buy/sell records for investments |
| `nps_units` | NPS unit history |
| `clients` | Freelance clients with status |
| `projects` | Client projects with status |
| `tags` | Custom tags |
| `transaction_tags` | Transaction-tag mappings |

---

## 🔄 Version History

### v1.7.0 (Current)
- **Monthly Decision Maker**: Automated financial engine to calculate monthly budgets and bank transfers based on custom logic.
- **Smart Data Sync**: Automatic pre-filling of salary, freelance, and expenses from transactions and bank accounts.
- **Execution Guide**: Clear bank-to-bank transfer instructions to maintain sacred buffers and investment targets.

### v1.6.0
- **Interactive PDF Notifications**: Directly open generated Invoice/Quotation files from the application.
- **Dynamic Balance Tracking**: Real-time calculation of account balances based on transaction history.
- **Enhanced PDF Template**: Refined table layouts and hidden fields for cleaner professional looks.
- **Character Sanitization**: Reliable rendering of currency symbols and non-printable characters.

### v1.5.0
- **Corporate Invoice System**: Itemized billing with Qty/Rate, tax & discounts.
- **UPI QR Codes**: Real-time amount-cured QR codes for instant payments.
- **Rich Client Profiles**: Store business details like GST, Address, and Contacts.
- **Corporate Quotation Redesign**: Professional multi-section proposals.

### v1.4.0
- Project & Client status tracking
- Investment portfolio with FD/RD/PPF/NPS calculations
- Live NPS NAV fetch from npsnav.in
- Enhanced investment display cards

### v1.3.1
- Bug fixes and performance improvements
- UI enhancements

### v1.3.0
- Investment lot tracking
- Live stock/MF price sync
- Platform-wise investment summary

---

## 📝 License

Private use only. Not for redistribution.

---

## 🤝 Contributing

This is a personal project. Contributions are not currently accepted.

---

Made with ❤️ for personal finance management
