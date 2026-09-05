import { Sparkles } from 'lucide-react';
import type { Spell } from '../../core/types';

export interface SpellDetailPanelProps {
  spell: Spell;
}

/** Archives info panel for the selected spell: type, lore, discovery + catalyst response. */
export default function SpellDetailPanel({ spell }: SpellDetailPanelProps) {
  return (
    <div
      data-chrome
      className="p-4 rounded-xl border border-amber-950 bg-[#1D1126]/90 backdrop-blur-sm shadow-md text-left transition-all duration-300"
      style={{ borderLeft: `4px solid ${spell.color}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase font-bold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          Boiling Isles Archives
        </span>
        <span className="text-[10px] font-mono text-amber-200/40">
          {spell.type === 'primitive' ? 'Foundational Glyph' : 'Synthesized Spell'}
        </span>
      </div>
      <h2 className="text-lg font-display font-medium text-amber-300 mt-1">
        {spell.name}
      </h2>
      <p className="text-xs text-amber-100/85 leading-relaxed mt-2 italic font-serif border-l-2 border-amber-700 pl-2">
        &ldquo;{spell.lore}&rdquo;
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-amber-900/20 text-[11px] font-serif">
        <div>
          <span className="text-amber-400/60 font-semibold">Chronicles of Discovery:</span>
          <p className="text-amber-200/80 mt-0.5 leading-relaxed">{spell.discovery}</p>
        </div>
        <div>
          <span className="text-amber-400/60 font-semibold">Active Catalyst Response:</span>
          <p className="text-amber-200/80 mt-0.5 leading-relaxed">{spell.visualDescription}</p>
        </div>
      </div>
    </div>
  );
}
