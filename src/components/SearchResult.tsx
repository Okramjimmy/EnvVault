import React from 'react';

interface SecretItem {
    id: number;
    key: string;
    valueMasked: string;
}

interface SearchResultProps {
    item: SecretItem;
    isSelected: boolean;
    isCopied: boolean;
    onClick: () => void;
    onMouseEnter: () => void;
    onDelete: (id: number) => void;
}

function SearchResult({ item, isSelected, isCopied, onClick, onMouseEnter, onDelete }: SearchResultProps) {
    return (
        <div
            className={`result-item ${isSelected ? 'selected' : ''} ${isCopied ? 'copied' : ''}`}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
        >
            <div className="result-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
            </div>

            <div className="result-content">
                <span className="result-key">{item.key}</span>
                <span className="result-value">{item.valueMasked}</span>
            </div>

            <div className="result-actions">
                <button
                    className="delete-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                    }}
                    title="Delete Secret"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>
                {isCopied ? (
                    <span className="copied-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Copied
                    </span>
                ) : (
                    <span className="copy-hint">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                        Copy
                    </span>
                )}
            </div>
        </div>
    );
}

export default SearchResult;
