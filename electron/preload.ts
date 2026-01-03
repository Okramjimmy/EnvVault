import { contextBridge, ipcRenderer } from 'electron';

interface SecretItem {
    id: number;
    key: string;
    valueMasked: string;
}

// Expose vault API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    hideWindow: () => ipcRenderer.invoke('hide-window'),

    // Vault operations
    searchVault: (query: string): Promise<SecretItem[]> => ipcRenderer.invoke('search-vault', query),
    getAllSecrets: (): Promise<SecretItem[]> => ipcRenderer.invoke('get-all-secrets'),
    getFullSecret: (id: number): Promise<string | null> => ipcRenderer.invoke('get-full-secret', id),
    addSecret: (key: string, value: string): Promise<boolean> => ipcRenderer.invoke('add-secret', key, value),
    deleteSecret: (id: number): Promise<boolean> => ipcRenderer.invoke('delete-secret', id),

    // Clipboard
    copyToClipboard: (text: string): Promise<void> => ipcRenderer.invoke('copy-to-clipboard', text),

    // Import/Export
    importEnv: (content: string): Promise<number> => ipcRenderer.invoke('import-env', content),
    exportEnv: (): Promise<string> => ipcRenderer.invoke('export-env'),

    // Shell sync - exports secrets to ~/.envvault for project usage
    syncToShell: (): Promise<boolean> => ipcRenderer.invoke('sync-to-shell'),
    getEnvvaultPath: (): Promise<string> => ipcRenderer.invoke('get-envvault-path')
});

