# Release Notes - v1.4.0

**Release Date:** January 26, 2026

---

## 🆕 New Features

### Project & Client Status Tracking

**Projects** now have a status field:
- 🟢 Active - Work in progress
- ⏸️ On Hold - Temporarily paused
- 🎯 Prospect - Not yet confirmed
- ✅ Completed - Successfully finished
- ❌ Cancelled - Project cancelled

**Clients** now have a status field:
- 🟢 Active - Currently working with
- 🎯 Prospect - Potential client
- 💤 Inactive - Past client

Status badges are displayed on cards with grouped views.

---

### Enhanced Investment Portfolio

**New Investment Fields:**
- Tenure (months)
- Opening Date
- Compounding frequency (monthly/quarterly/yearly)
- Bank/Fund Manager name
- Category linking for deposit auto-tracking

**Investment Calculations:**
| Type | Feature |
|------|---------|
| **FD** | Compound interest calculation |
| **RD** | Monthly deposits with interest |
| **PPF** | 7.1% annual, maturity countdown |
| **NPS** | Live NAV fetch from npsnav.in |

**NPS NAV Fetch:**
- 📡 NAV button in NPS form
- Fetches current NAV from npsnav.in API
- Auto-populates NAV field

**Enhanced Display:**
- NPS/PPF cards show Current Value, Returns %, Days to Maturity
- Bank/Fund Manager displayed on cards

---

## 📦 Database Changes
- Added `status` column to projects table
- Added `status` column to clients table
- Added new investment fields: `tenure_months`, `opening_date`, `compounding`, `bank_name`, `category_id`
- Added `nps_units` table for unit tracking

---

## 🔧 Technical
- New utility: `investmentCalculations.ts` with FD/RD/PPF/NPS calculation functions
- Updated Investment TypeScript interface
- Enhanced Investments.tsx with NPS/PPF form section

---

**Full Changelog:** v1.3.1 → v1.4.0
