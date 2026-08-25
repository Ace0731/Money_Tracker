# Changelog

All notable changes to this project will be documented in this file.

## [2.5.0] - 2026-08-25
### Added
- **Account Creation Fixes & Alerts**: Resolved Rust IPC deserialization issues (`is_investment_active`) and added SweetAlert popups for user feedback.
- **Dashboard Net Worth Plot Chart**: Added interactive multi-series chart for Net Worth, Income, Expenses, and Investments with 6-month & 12-month toggles.
- **Fiscal Year Standard (April - March)**: Integrated Indian Fiscal Year (`April 1 to March 31`) defaults across Dashboard, Income Breakdown, and Reports screens.
- **Monthly Average Income**: Integrated Monthly Average Income metrics in top stats and per-category views in Income Breakdown and Reports sections.
- **Projects & Clients Effort Analytics**: Added cumulative project value, cumulative effort value, actual hourly rate, and efficiency metrics across Projects and Clients screens.

## [1.7.0] - 2026-02-24
### Added
- **Monthly Decision Maker**: A strict financial logic engine to manage salary and freelance income.
- **Smart Transfer Guide**: Automated calculations for moving funds between HDFC, SBI, and Slice accounts.
- **Auto-Fetch Integration**: Real-time synchronization with transaction and account data.
- **Stable Strategy**: Income timing logic (April/May bridge) to ensure safe investing.
- **MSI & EXE Build Support**: Updated Tauri configuration to generate both installer formats.

## [1.6.0] - 2026-02-23
### Added
- **Interactive PDF Notifications**: Directly open generated Invoice/Quotation files from the app.
- **Dynamic Balance Tracking**: Real-time account balance calculation from transaction history.
- **Enhanced PDF Template**: Refined layouts with character sanitization and hidden fields.

## [1.5.0] - 2026-01-20
### Added
- **Corporate Invoice System**: Itemized billing, tax, and discount management.
- **UPI QR Codes**: Dynamic QR code generation for payments.
- **Rich Client Profiles**: Management of business details (GST, Address).
- **Corporate Quotation Redesign**: Professional Proposal templates.

## [1.4.0] - 2026-01-10
### Added
- Project & Client status tracking.
- Investment portfolio (FD, RD, PPF, NPS) with live price/NAV fetch.

## [1.3.1] - 2026-01-05
### Changed
- UI enhancements and general performance optimizations.

## [1.3.0] - 2025-12-30
### Added
- Investment lot tracking and buy/sell history.
- Platform-wise investment summaries.
