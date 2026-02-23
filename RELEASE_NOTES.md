# Release Notes - v1.6.0

**Release Date:** February 23, 2026

---

## 🆕 New Features

### 📂 Interactive PDF Notifications
- **One-Click Access**: Success notifications for Invoices and Quotations now include an **"Open Folder"** button. This instantly opens your system explorer and highlights the generated PDF file.
- **Streamlined Workflow**: No more manual searching through the Downloads folder to find your generated documents.

### ⚖️ Dynamic Real-Time Balances
- **Sophisticated Calculation Engine**: The app now calculates balances in real-time by processing your entire transaction history.
- **Dashboard Synchronization**: Your net worth and account-wise totals are perfectly synced with every transaction you add or edit.
- **"Dual-Account" Protection**: Enhanced logic to prevent transactions from having the same source and destination, ensuring data accuracy.

---

## 🔧 Improvements & Fixes

### Professional PDF Enhancements
- **Character Sanitization**: Fixed "strange character" issues (like `&` appearing in descriptions) by implementing a robust sanitization layer. Currency symbols are now handled gracefully.
- **Refined Templates**: Updated the PDF engine with cleaner layouts, improved character spacing, and high-contrast tables.
- **Smart Field Management**: The PDF now automatically hides empty bank/payment sections for a more professional finish when certain details aren't provided.

### General Updates
- **Local Time Accuracy**: Transaction dates now strictly follow your local system time, fixing discrepancies for entries made late in the evening.
- **Backend Refactoring**: Core database queries optimized for faster dashboard performance.

---

**Full Changelog:** v1.5.0 → v1.6.0
