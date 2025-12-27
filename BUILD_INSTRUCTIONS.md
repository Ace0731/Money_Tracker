# Building Production Executable

## 🚀 Build Your Standalone .exe

### Step 1: Build the Production App

In your terminal, run:

```bash
npm run tauri build
```

**Wait time:** 5-10 minutes (first build takes longer)

### Step 2: Find Your .exe File

After build completes, your executable will be at:

```
G:\Projects\Money_Tracker\src-tauri\target\release\money-tracker.exe
```

**File size:** ~10-15 MB

---

## 📁 Database Location in Production

**Important:** The database location is DIFFERENT in production vs development!

### Development Mode (`npm run tauri dev`)
- Database: `G:\Projects\Money_Tracker\money_tracker.db`
- In project folder

### Production Mode (`.exe`)
- Database: `C:\Users\HP\AppData\Roaming\com.moneytracker.app\money_tracker.db`
- In user's AppData folder

**This means your development data WON'T transfer automatically!**

---

## 💾 Copying Your Data to Production

If you want to keep your development data:

### Option 1: Copy Database After First Run

1. Run `money-tracker.exe` once (creates the database)
2. Close the app
3. Copy from: `G:\Projects\Money_Tracker\money_tracker.db`
4. Paste to: `C:\Users\HP\AppData\Roaming\com.moneytracker.app\money_tracker.db`
5. Replace when prompted
6. Restart the app - your data is there!

### Option 2: Start Fresh
- Just run the .exe and add your data again
- Clean start in production

---

## 📦 What You Get

After building, you'll have:

**Installer:**
- `src-tauri\target\release\bundle\msi\money-tracker_0.1.0_x64_en-US.msi`
- Can install on any Windows PC

**Portable .exe:**
- `src-tauri\target\release\money-tracker.exe`
- Run directly without installation

---

## ✅ Using the Production App

1. **Double-click** `money-tracker.exe`
2. App opens just like normal Windows software
3. All data saves to: `%APPDATA%\com.moneytracker.app\money_tracker.db`
4. Your data persists between runs!

---

## 🔄 Backing Up Your Data

**Production database location:**
```
C:\Users\HP\AppData\Roaming\com.moneytracker.app\money_tracker.db
```

**To backup:**
1. Close the app
2. Copy `money_tracker.db` to backup location (USB, cloud, etc.)

**To restore:**
1. Close the app
2. Replace `money_tracker.db` with your backup
3. Restart the app

---

## 🎯 Summary

| Mode | Command | Database Location |
|------|---------|-------------------|
| **Development** | `npm run tauri dev` | `G:\Projects\Money_Tracker\money_tracker.db` |
| **Production** | Run `.exe` | `%APPDATA%\com.moneytracker.app\money_tracker.db` |

**Build Command:** `npm run tauri build`

**Result:** Standalone `.exe` that runs on any Windows PC!
