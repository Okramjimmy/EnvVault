# EnvVault

EnvVault is a secure, developer-friendly environment variable manager. It features a Spotlight-like UI for quick access to your secrets, secure storage using native SQLite, and seamless project integration.

## Features

- 🔒 **Secure Storage**: Secrets are stored in a local SQLite database (encrypted support coming soon).
- 🔍 **Spotlight UI**: Press `Cmd+Shift+Space` instantly search and copy secrets.
- 📋 **One-Click Copy**: Quickly copy keys or values to clipboard.
- 🐚 **Shell Integration**: Sync secrets to `~/.envvault` and automatically load them in your shell sessions.
- 📱 **Menu Bar App**: Runs quietly in the background, accessible via menu bar icon.
- 🦀 **Native Performance**: Core logic written in Rust for speed and safety.

## Installation

### Prerequisites
- Node.js (v18+)
- Rust (latest stable) for native module compilation

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd EnvVault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the Rust core**
   ```bash
   npm run build:rust
   ```

4. **Start Development Server**
   ```bash
   npm run dev:full
   ```
   This command builds the Rust module and starts the Electron app with hot-reload.

## Building for Production

To create a macOS DMG installer:

```bash
npm run build:mac
```

The output DMG file will be located in the `release/` directory.

## Usage

1. **Launch EnvVault**: Open the app or run from development.
2. **Open Search**: Press `Cmd+Shift+Space` or click the lock icon in the menu bar.
3. **Add Secret**: Switch to "Add" mode or use the + button.
4. **Search**: Type to filter secrets.
5. **Copy**: Press Enter to copy the secret value, or click the copy icon.

## Project Structure

- `electron/`: Main and Preload scripts for Electron.
- `src/`: React frontend application.
- `vault-core/`: Rust backend using NAPI-RS for native performance.
- `resources/`: Icons and assets.

## Technologies

- **Frontend**: React, TypeScript, Vite
- **Backend**: Rust, NAPI-RS, SQLite
- **Runtime**: Electron
