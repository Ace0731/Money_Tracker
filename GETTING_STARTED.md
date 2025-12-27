# Getting Started with Money Tracker

## Quick Start

### 1. Install Rust
If you don't have Rust installed:

**Windows:**
- Download and run [rustup-init.exe](https://rustup.rs/)
- Restart your terminal after installation

**Verify installation:**
```bash
rustc --version
cargo --version
```

### 2. Install Dependencies

In the project directory:
```bash
npm install
```

### 3. Run Development Mode

```bash
npm run tauri dev
```

This will:
- Start the Vite dev server for React
- Compile the Rust backend
- Launch the desktop application

**First run may take 5-10 minutes** as Rust compiles all dependencies.

### 4. Build for Production

```bash
npm run tauri build
```

The installer will be in `src-tauri/target/release/bundle/`

## Troubleshooting

### Rust not found
Make sure Rust is in your PATH. Restart your terminal/IDE after installing Rust.

### Build fails
```bash
# Clear cache and rebuild
cd src-tauri
cargo clean
cd ..
npm run tauri dev
```

### Database errors
Delete `money_tracker.db` and restart the app - it will recreate the database.

## Usage

### Adding Accounts
1. Go to Accounts screen
2. Click "Add Account"
3. Fill in details (name, type, opening balance)
4. Save

### Adding Transactions
1. Go to Transactions screen
2. Click "Add Transaction"
3. Select direction (income/expense/transfer)
4. Fill in amount, account, category
5. Optionally add client, project, tags, notes
6. Save

### Viewing Reports
- Dashboard shows summary cards and charts
- Reports screen has detailed breakdowns

## Database Location

The SQLite database file `money_tracker.db` is created in the app's working directory.

To backup your data:
- Copy `money_tracker.db` to a safe location
- Use the Export feature (coming soon)

## Next Steps

Check out:
- `src/screens/` for UI components
- `src-tauri/src/commands/` for backend logic
- `database/schema.sql` for database structure
