import { app, BrowserWindow, globalShortcut, screen, Tray, Menu, nativeImage, ipcMain, clipboard } from 'electron';
import path from 'path';

// Import Rust vault-core module
let vaultCore: any = null;
try {
    // Determine path based on environment
    const vaultCorePath = app.isPackaged
        ? path.join(process.resourcesPath, 'vault-core')
        : path.join(__dirname, '../../vault-core');
    vaultCore = require(vaultCorePath);
    // Initialize the database on startup
    vaultCore.initDatabase();
    console.log('vault-core loaded successfully');
} catch (e) {
    console.error('Failed to load vault-core:', e);
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow() {
    const { width } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: 680,
        height: 480,
        x: Math.round((width - 680) / 2),
        y: 150,
        frame: false,
        transparent: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        show: false,
        hasShadow: true,
        vibrancy: 'under-window',
        visualEffectState: 'active',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        }
    });

    // Load React App
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Hide when losing focus
    mainWindow.on('blur', () => {
        if (mainWindow && !mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.hide();
        }
    });
}

function createTray() {
    // Use 22x22 icon for menu bar (macOS standard)
    const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'resources', 'iconTemplate@1x.png')
        : path.join(__dirname, '../../resources/iconTemplate@1x.png');
    let icon: Electron.NativeImage;

    try {
        icon = nativeImage.createFromPath(iconPath);
        // Mark as template for macOS dark mode support
        icon.setTemplateImage(true);
    } catch {
        icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);
    tray.setToolTip('EnvVault - Click to open');

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Open EnvVault', click: () => toggleWindow() },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => toggleWindow());
}

function toggleWindow() {
    if (mainWindow?.isVisible()) {
        mainWindow.hide();
    } else {
        mainWindow?.show();
        mainWindow?.focus();
    }
}

// Register IPC handlers for Rust vault-core
function registerIpcHandlers() {
    ipcMain.handle('hide-window', () => {
        mainWindow?.hide();
    });

    ipcMain.handle('search-vault', (_event, query: string) => {
        if (vaultCore) {
            return query.length > 0 ? vaultCore.searchVault(query) : vaultCore.getAllSecrets();
        }
        return [];
    });

    ipcMain.handle('get-all-secrets', () => {
        if (vaultCore) {
            return vaultCore.getAllSecrets();
        }
        return [];
    });

    ipcMain.handle('get-full-secret', (_event, id: number) => {
        if (vaultCore) {
            return vaultCore.getFullSecret(id);
        }
        return null;
    });

    ipcMain.handle('add-secret', (_event, key: string, value: string) => {
        if (vaultCore) {
            return vaultCore.addSecret(key, value);
        }
        return false;
    });

    ipcMain.handle('delete-secret', (_event, id: number) => {
        if (vaultCore) {
            return vaultCore.deleteSecret(id);
        }
        return false;
    });

    ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
        clipboard.writeText(text);
    });

    ipcMain.handle('import-env', (_event, content: string) => {
        if (vaultCore) {
            return vaultCore.importFromEnvString(content);
        }
        return 0;
    });

    ipcMain.handle('export-env', () => {
        if (vaultCore) {
            return vaultCore.exportToEnvString();
        }
        return '';
    });

    ipcMain.handle('sync-to-shell', () => {
        if (vaultCore) {
            return vaultCore.syncToShell();
        }
        return false;
    });

    ipcMain.handle('get-envvault-path', () => {
        if (vaultCore) {
            return vaultCore.getEnvvaultFilePath();
        }
        return '~/.envvault';
    });
}

app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
    createTray();

    globalShortcut.register('CommandOrControl+Shift+Space', toggleWindow);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
