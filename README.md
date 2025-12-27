# Money Tracker

A local-only personal finance tracker built with React, Tauri, and SQLite.

## Features

- 💰 Track every transaction (income, expense, transfers)
- 📊 Visual reports and dashboards
- 👥 Client and project management
- 🏷️ Multi-tag support
- 🔒 100% local - no cloud, no internet required
- 📁 Export/Import (CSV, JSON, DB file)

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Desktop**: Tauri (Rust)
- **Database**: SQLite
- **Charts**: Recharts
- **State**: Zustand

## Prerequisites

Before running this project, ensure you have:

- Node.js (v18+)
- Rust (latest stable)
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Project Structure

```
money-tracker/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── screens/           # Main screens
│   ├── store/             # Zustand state
│   └── utils/             # Utilities
├── src-tauri/             # Tauri backend (Rust)
│   └── src/
│       ├── commands/      # Tauri commands
│       └── db/            # Database logic
└── database/              # SQL schema
```

## Database Schema

The database uses SQLite with the following tables:
- `accounts` - Bank/cash/investment accounts
- `categories` - Income/expense categories
- `transactions` - All money movements
- `clients` - Freelance clients
- `projects` - Client projects
- `tags` - Transaction tags
- `transaction_tags` - Many-to-many relationship

## Development

The app runs entirely locally. All data is stored in `money_tracker.db` in the app directory.

## License

Private use only.
