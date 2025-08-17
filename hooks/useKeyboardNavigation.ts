import { useEffect, useRef } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (e: KeyboardEvent) => void;
  description?: string;
}

export function useKeyboardNavigation(
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.matches('input, textarea, [contenteditable="true"]')) {
        return;
      }

      for (const shortcut of shortcutsRef.current) {
        const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const matchesCtrl = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const matchesShift = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const matchesAlt = shortcut.alt ? e.altKey : !e.altKey;
        const matchesMeta = shortcut.meta ? e.metaKey : true;

        if (matchesKey && matchesCtrl && matchesShift && matchesAlt && matchesMeta) {
          e.preventDefault();
          shortcut.handler(e);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  return {
    getShortcutString: (shortcut: KeyboardShortcut) => {
      const parts = [];
      if (shortcut.ctrl) parts.push('Ctrl');
      if (shortcut.shift) parts.push('Shift');
      if (shortcut.alt) parts.push('Alt');
      if (shortcut.meta) parts.push('Cmd');
      parts.push(shortcut.key.toUpperCase());
      return parts.join('+');
    }
  };
}
