# Changelog

All notable changes to this project will be documented in this file.

## [2.5.0] - 2026-08-26
### Added
- **Income Tax Estimator Page (`/taxes`)**: Dedicated annual tax estimator comparing New Tax Regime vs Old Tax Regime, complete with interactive dual-bar regime comparison charts, post-tax retention donut chart, effective tax rate metrics, and 80C/80D/NPS deduction calculations.
- **Category Tax Use Flags**: Added `include_in_tax` database column migration, frontend category configuration checkbox, and `🏷️ Taxable` badges for auto-tracking taxable income.
- **Projects Net Profit & Profit Margin Metrics**:
  - Added **Cumulative Net Profit** card to the top stats banner (`Total Received − Total Effort Cost`).
  - Added **Effort Cost**, **Net Profit**, and **Margin %** to active project cards and completed project tables.
- **Upgraded Asset Allocation Portfolio Matrix**: Replaced simple donut chart with an interactive **Portfolio Heatmap Matrix** and **Smart Rebalancing Assistant** (evaluating Equity vs Debt target allocations with actionable monetary advice).
- **SweetAlert2 UI Audit**: Standardized all native browser `alert()` and `confirm()` dialogs across the entire application with custom dark-themed SweetAlert2 (`Swal.fire`) modals.
- **Fiscal Year Standard (April - March)**: Integrated Indian Fiscal Year (`April 1 to March 31`) standard across Dashboard, Income Breakdown, Taxes, and Reports screens.
- **Reports & Portfolio Enhancements**: Added 50/30/20 Financial Health Rule Compliance card, Client Profitability Matrix (`₹/hr`), and Top Performers ROI Ranking bar chart.

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
