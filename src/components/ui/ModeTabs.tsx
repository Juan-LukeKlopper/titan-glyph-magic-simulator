import { Flame, Wand2 } from 'lucide-react';
import type { Spell } from '../../core/types';

export interface ModeTabsProps {
  practiceMode: boolean;
  onTrace: () => void;
  onSandbox: () => void;
  selectedSpell: Spell | null;
}

/** Trace Inscription / Sandbox Free-draw mode switcher plus the "Target:" chip. */
export default function ModeTabs({ practiceMode, onTrace, onSandbox, selectedSpell }: ModeTabsProps) {
  return (
    <div data-chrome className="flex items-center justify-between bg-[#1C0F25] p-2 rounded-xl border border-amber-900/30 shadow-inner">
      <div className="flex gap-1.5">
        <button
          id="mode-trace-btn"
          type="button"
          onClick={onTrace}
          aria-pressed={practiceMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
            practiceMode
              ? 'bg-amber-950/85 border border-amber-800/40 text-amber-300'
              : 'bg-transparent text-amber-200/40 hover:text-amber-200 border border-transparent'
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          Trace Inscription
        </button>
        <button
          id="mode-sandbox-btn"
          type="button"
          onClick={onSandbox}
          aria-pressed={!practiceMode}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-wide transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
            !practiceMode
              ? 'bg-amber-950/85 border border-amber-800/40 text-amber-300'
              : 'bg-transparent text-amber-200/40 hover:text-amber-200 border border-transparent'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          Sandbox Free-draw
        </button>
      </div>

      {selectedSpell && practiceMode && (
        <div className="flex items-center gap-2 pr-1.5">
          <span className="text-[10px] text-amber-200/40 font-mono">Target:</span>
          <span
            className="text-[10px] font-mono uppercase bg-[#110917] px-2 py-0.5 rounded border text-amber-200"
            style={{ borderColor: selectedSpell.color }}
          >
            {selectedSpell.name.split(' ')[0]}
          </span>
        </div>
      )}
    </div>
  );
}
