import { forwardRef } from 'react';
import type { Spell } from '../../core/types';

export interface SpellCardProps {
  spell: Spell;
  selected: boolean;
  onSelect: (spell: Spell) => void;
}

function getDifficultyBadgeColor(diff: string) {
  switch (diff) {
    case 'Novice': return 'bg-amber-950/70 text-amber-300 border border-amber-800/40';
    case 'Apprentice': return 'bg-purple-950/70 text-purple-300 border border-purple-800/35';
    case 'Adept': return 'bg-[#4c1d95]/70 text-[#c084fc] border border-purple-700/40';
    case 'Master': return 'bg-[#831843]/70 text-[#f472b6] border border-pink-700/40';
    case 'Titan-Level': return 'bg-yellow-950/70 text-yellow-200 border border-yellow-700/40 animate-pulse';
    default: return 'bg-[#21142A] text-amber-200/50 border border-amber-900/40';
  }
}

/** One spellbook entry: title row, description, and the combinatorial recipe box. */
const SpellCard = forwardRef<HTMLDivElement, SpellCardProps>(function SpellCard(
  { spell, selected, onSelect },
  ref,
) {
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${spell.name}, ${spell.difficulty} difficulty`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(spell);
        }
      }}
      onClick={() => onSelect(spell)}
      className={`p-4 rounded-xl border transition-all cursor-pointer select-none text-left flex flex-col gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
        selected
          ? 'bg-[#291838]/95 border-amber-500 shadow-xl shadow-amber-950/10 animate-pulse-subtle'
          : 'bg-[#1C0F25]/75 border-[#2E183B] hover:border-amber-900/40 hover:bg-[#21122C]'
      }`}
    >
      {/* Spell Card Line Title */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: spell.color,
              boxShadow: `0 0 10px ${spell.shadowColor}`,
            }}
          />
          <h3 className={`font-display font-medium text-sm ${selected ? 'text-amber-400 font-semibold' : 'text-amber-100/90'}`}>
            {spell.name}
          </h3>
        </div>
        <span className={`px-2 py-0.5 rounded font-mono text-[9px] uppercase font-semibold ${getDifficultyBadgeColor(spell.difficulty)}`}>
          {spell.difficulty}
        </span>
      </div>

      <p className="text-xs text-amber-200/70 font-serif leading-relaxed line-clamp-2">
        {spell.description}
      </p>

      {/* Meta Alchemical Recipe if Combinatory */}
      {spell.recipe && (
        <div className="bg-[#110917]/70 border border-amber-900/20 rounded p-2 text-[10px] font-serif leading-relaxed flex items-start gap-2">
          <span className="text-amber-400 font-semibold flex-shrink-0">Combination:</span>
          <span className="text-amber-200/60 line-clamp-1 italic">{spell.recipe.layout}</span>
        </div>
      )}
    </div>
  );
});

export default SpellCard;
