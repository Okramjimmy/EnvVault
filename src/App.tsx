import React, { useState, useEffect, useCallback, useRef } from 'react';
import SearchResult from './components/SearchResult';

interface SecretItem {
    id: number;
    key: string;
    valueMasked: string;
}

// Type for the electron API
declare global {
    interface Window {
        electronAPI?: {
            hideWindow: () => Promise<void>;
            searchVault: (query: string) => Promise<SecretItem[]>;
            getAllSecrets: () => Promise<SecretItem[]>;
            getFullSecret: (id: number) => Promise<string | null>;
            addSecret: (key: string, value: string) => Promise<boolean>;
            deleteSecret: (id: number) => Promise<boolean>;
            copyToClipboard: (text: string) => Promise<void>;
            importEnv: (content: string) => Promise<number>;
            exportEnv: () => Promise<string>;
            syncToShell: () => Promise<boolean>;
            getEnvvaultPath: () => Promise<string>;
        };
    }
}

// No mock data - use real database only

type ViewMode = 'search' | 'add' | 'export';

function App() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SecretItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [copied, setCopied] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('search');

    // Add secret form state
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [addStatus, setAddStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Export state
    const [exportContent, setExportContent] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);

    const loadSecrets = useCallback(async () => {
        try {
            if (window.electronAPI) {
                const secrets = await window.electronAPI.getAllSecrets();
                setResults(secrets);
            } else {
                console.warn('electronAPI not available - running outside Electron');
                setResults([]);
            }
        } catch (e) {
            console.error('Failed to load secrets:', e);
            setResults([]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadSecrets();
    }, [loadSecrets]);

    // Search on query change
    useEffect(() => {
        if (viewMode !== 'search') return;

        const search = async () => {
            try {
                if (window.electronAPI) {
                    const secrets = await window.electronAPI.searchVault(query);
                    setResults(secrets);
                    setSelectedIndex(0);
                } else {
                    console.warn('electronAPI not available - search skipped');
                    setResults([]);
                    setSelectedIndex(0);
                }
            } catch (e) {
                console.error('Search failed:', e);
            }
        };
        search();
    }, [query, viewMode]);

    const handleCopy = useCallback(async (id: number) => {
        try {
            if (window.electronAPI) {
                const secret = await window.electronAPI.getFullSecret(id);
                if (secret) {
                    await window.electronAPI.copyToClipboard(secret);
                    setCopied(id);
                    setTimeout(() => setCopied(null), 1500);
                }
            }
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }, []);

    const handleAddSecret = async () => {
        if (!newKey.trim() || !newValue.trim()) return;

        if (!window.electronAPI) {
            console.error('electronAPI not available');
            setAddStatus('error');
            return;
        }

        try {
            const success = await window.electronAPI.addSecret(newKey.trim(), newValue.trim());
            if (success) {
                // Auto-sync to shell so projects can use the secret immediately
                await window.electronAPI.syncToShell();
                setAddStatus('success');
                setNewKey('');
                setNewValue('');
                await loadSecrets();
                setTimeout(() => {
                    setAddStatus('idle');
                    setViewMode('search');
                }, 1000);
            } else {
                console.error('addSecret returned false');
                setAddStatus('error');
            }
        } catch (err) {
            console.error('Failed to add secret:', err);
            setAddStatus('error');
        }
    };

    const handleExport = async () => {
        if (window.electronAPI) {
            const content = await window.electronAPI.exportEnv();
            setExportContent(content);
        } else {
            setExportContent('# No secrets available - electronAPI not loaded');
        }
        setViewMode('export');
    };

    const handleCopyExport = async () => {
        if (window.electronAPI) {
            await window.electronAPI.copyToClipboard(exportContent);
        } else {
            await navigator.clipboard.writeText(exportContent);
        }
        setCopied(-1);
        setTimeout(() => setCopied(null), 1500);
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (viewMode !== 'search') {
            if (e.key === 'Escape') {
                setViewMode('search');
                setNewKey('');
                setNewValue('');
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleCopy(results[selectedIndex].id);
                }
                break;
            case 'Escape':
                if (window.electronAPI) {
                    window.electronAPI.hideWindow();
                }
                setQuery('');
                break;
        }
    }, [viewMode, results, selectedIndex, handleCopy]);

    // Render Add Secret View
    const renderAddView = () => (
        <div className="add-secret-view">
            <div className="add-header">
                <h2>Add New Secret</h2>
                <button className="close-btn" onClick={() => setViewMode('search')}>×</button>
            </div>

            <div className="add-form">
                <div className="form-group">
                    <label>Key Name</label>
                    <input
                        type="text"
                        placeholder="e.g., OPENAI_API_KEY"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                        autoFocus
                    />
                </div>

                <div className="form-group">
                    <label>Secret Value</label>
                    <input
                        type="password"
                        placeholder="Enter secret value..."
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                    />
                </div>

                <button
                    className={`add-btn ${addStatus}`}
                    onClick={handleAddSecret}
                    disabled={!newKey.trim() || !newValue.trim()}
                >
                    {addStatus === 'success' ? '✓ Added!' : addStatus === 'error' ? 'Error' : 'Add Secret'}
                </button>
            </div>

            <div className="add-hint">
                <p>Secrets are stored securely in your local vault.</p>
                <p>Use <kbd>Export</kbd> to copy them to your project's .env file.</p>
            </div>
        </div>
    );

    // Render Export View
    const renderExportView = () => (
        <div className="export-view">
            <div className="export-header">
                <h2>Export to .env</h2>
                <button className="close-btn" onClick={() => setViewMode('search')}>×</button>
            </div>

            <div className="export-content">
                <pre>{exportContent || 'No secrets to export'}</pre>
            </div>

            <div className="export-actions">
                <button
                    className={`copy-btn ${copied === -1 ? 'copied' : ''}`}
                    onClick={handleCopyExport}
                >
                    {copied === -1 ? '✓ Copied!' : 'Copy to Clipboard'}
                </button>
            </div>

            <div className="export-hint">
                <p>Paste this content into your project's <code>.env</code> file.</p>
            </div>
        </div>
    );

    const handleDeleteSecret = async (id: number) => {
        if (!confirm('Are you sure you want to delete this secret?')) return;
        if (!window.electronAPI) {
            console.error('electronAPI not available');
            return;
        }

        try {
            const success = await window.electronAPI.deleteSecret(id);
            if (success) {
                await window.electronAPI.syncToShell();
                await loadSecrets();
                // If we were in search mode, re-search to update list
                if (viewMode === 'search' && query) {
                    const secrets = await window.electronAPI.searchVault(query);
                    setResults(secrets);
                }
            }
        } catch (err) {
            console.error('Failed to delete secret:', err);
        }
    };

    // Render Search View
    const renderSearchView = () => (
        <>
            {/* Search Bar */}
            <div className="search-container">
                <div className="search-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                    </svg>
                </div>
                <input
                    ref={inputRef}
                    autoFocus
                    type="text"
                    placeholder="Search secrets..."
                    className="search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <div className="action-buttons">
                    <button className="action-btn add" onClick={() => setViewMode('add')} title="Add Secret">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                    <button className="action-btn export" onClick={handleExport} title="Export .env">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Results List */}
            <div className="results-container">
                {loading ? (
                    <div className="no-results">
                        <span className="loading-spinner" />
                        <span>Loading secrets...</span>
                    </div>
                ) : results.length === 0 ? (
                    <div className="no-results">
                        <span className="no-results-icon">🔐</span>
                        <span>No secrets found</span>
                        <button className="inline-add-btn" onClick={() => setViewMode('add')}>
                            + Add your first secret
                        </button>
                    </div>
                ) : (
                    results.map((item, index) => (
                        <SearchResult
                            key={item.id}
                            item={item}
                            isSelected={index === selectedIndex}
                            isCopied={copied === item.id}
                            onClick={() => handleCopy(item.id)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            onDelete={handleDeleteSecret}
                        />
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="footer">
                <span className="footer-hint">
                    <kbd>↑↓</kbd> navigate
                </span>
                <span className="footer-hint">
                    <kbd>↵</kbd> copy
                </span>
                <span className="footer-hint">
                    <kbd>esc</kbd> close
                </span>
            </div>
        </>
    );

    return (
        <div className="app-container" onKeyDown={handleKeyDown}>
            <div className="drag-region" />

            {viewMode === 'search' && renderSearchView()}
            {viewMode === 'add' && renderAddView()}
            {viewMode === 'export' && renderExportView()}
        </div>
    );
}

export default App;
