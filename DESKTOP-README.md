# School Guardian Suite - Desktop Application

A fully offline Windows desktop application for school management.

## Features

- 🎓 **Student Management** - Add, edit, promote students
- 💰 **Fees Management** - Fee structure, collections, defaulter reports
- 👨‍🏫 **Staff Management** - Teacher and staff records
- 🏫 **Multi-School Support** - White-labeling with custom logos and colors
- 📱 **ID Card Generation** - Printable student ID cards
- 📄 **Receipt Generation** - Fee payment receipts
- 💾 **Offline Database** - SQLite, no internet required
- 🔒 **Secure** - Local data storage

## Installation

### Option 1: Download Installer (Recommended)
1. Download `School Guardian Suite Setup.exe` from releases
2. Run the installer
3. Follow the installation wizard
4. Launch from Desktop shortcut

### Option 2: Build from Source

```bash
# Install dependencies
npm install

# Build the application
npm run build:desktop

# The installer will be in dist/ folder
```

## Running in Development

```bash
# Install all dependencies
npm install

# Build client and run Electron
npm run build:desktop:dev
```

## Default Login

- **Username:** `admin`
- **Password:** `admin123`

## Database Location

The database is stored in:
- Windows: `%APPDATA%\school_guardian.db`

## Backup & Restore

To backup your data:
1. Go to Settings in the app
2. Click "Backup Database"
3. The database file will be saved to your Downloads folder

## System Requirements

- Windows 10 or higher
- 64-bit processor
- 4GB RAM minimum
- 500MB disk space

## Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **Desktop:** Electron
- **Database:** SQLite (better-sqlite3)
- **Build:** Vite + Electron Builder

## License

MIT License
