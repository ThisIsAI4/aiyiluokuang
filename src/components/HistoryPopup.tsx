import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  query: string;
  items: string[];
  onSelect: (text: string) => void;
  onClose: () => void;
}

/**
 * Floating history popup triggered by Ctrl+R.
 * Renders above the input bar, supports ↑/↓ keyboard navigation.
 */
export default function HistoryPopup({ query, items, onSelect, onClose }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset active index when filtered list changes
  useEffect(() => { setActiveIdx(0); }, [items]);

  // Auto-focus the filter input on open
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx(i => Math.max(0, i - 1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx(i => Math.min(items.length - 1, i + 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (items[activeIdx]) onSelect(items[activeIdx]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [items, activeIdx, onSelect, onClose]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (listRef.current?.parentElement?.contains(e.target as Node)) return;
      onClose();
    };
    // Delay to avoid the opening click immediately closing
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  if (items.length === 0) {
    return (
      <div className="history-popup" onKeyDown={handleKeyDown}>
        <div className="history-popup-header">
          <input
            ref={inputRef}
            className="history-popup-input"
            value={query}
            readOnly
            placeholder="No history yet"
          />
          <span className="history-popup-hint">Esc to close</span>
        </div>
        <div className="history-popup-empty">No matches</div>
      </div>
    );
  }

  return (
    <div className="history-popup" onKeyDown={handleKeyDown}>
      <div className="history-popup-header">
        <input
          ref={inputRef}
          className="history-popup-input"
          value={query}
          readOnly
          placeholder="Filter history…"
        />
        <span className="history-popup-hint">↑↓ navigate · Enter select · Esc close</span>
      </div>
      <div className="history-popup-list" ref={listRef}>
        {items.map((item, i) => (
          <div
            key={`${item}-${i}`}
            className={`history-popup-item${i === activeIdx ? ' active' : ''}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setActiveIdx(i)}
          >
            <span className="history-popup-item-text">{highlightMatch(item, query)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Highlight the matching substring within item text. */
function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="history-popup-mark">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
