import { useEffect } from 'react';

export interface KeyboardShortcutHandlers {
  /** M — toggle mute. */
  onToggleMute: () => void;
  /** T — switch to Trace Inscription mode. */
  onTrace: () => void;
  /** S — switch to Sandbox free-draw and clear the active tracer. */
  onSandbox: () => void;
}

/**
 * Global keyboard shortcuts: M mute toggle, T trace mode, S sandbox
 * (+ clear selection), / focus search, Esc blur inputs. Keystrokes are
 * ignored while typing in fields or focused on interactive controls.
 * Pass a memoized (stable) handlers object so the listener is attached
 * once, mirroring the original mount-once keydown handler.
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't hijack typing in fields, or activate shortcuts while the user is
      // focused on an interactive control (buttons, selects, links).
      if (!target) {return;}
      const tag = target.tagName;
      const isTypingTarget = tag === 'INPUT' || tag === 'TEXTAREA';
      const isInteractive = tag === 'BUTTON' || tag === 'SELECT' || tag === 'A' || target.isContentEditable;
      if (isTypingTarget) {
        if (e.key === 'Escape') {(target as HTMLInputElement).blur();}
        return;
      }
      if (isInteractive) {return;}

      if (e.key === 'm' || e.key === 'M') {handlers.onToggleMute();}
      else if (e.key === 't' || e.key === 'T') {handlers.onTrace();}
      else if (e.key === 's' || e.key === 'S') {
        handlers.onSandbox();
      } else if (e.key === '/') {
        e.preventDefault();
        document.getElementById('spell-search-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}
