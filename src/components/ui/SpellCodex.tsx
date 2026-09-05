import { BookOpen, Compass } from 'lucide-react';
import type { Spell } from '../../core/types';
import SpellCard from './SpellCard';

const DIFFICULTY_LEVELS = ['All', 'Novice', 'Apprentice', 'Adept', 'Master', 'Titan-Level'] as const;

export interface SpellCodexProps {
  spells: Spell[];
  selectedSpell: Spell | null;
  onSelectSpell: (spell: Spell) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  selectedDifficulty: string;
  onSelectDifficulty: (difficulty: string) => void;
}

/**
 * Left-hand spellbook column: search + difficulty filter controls, the
 * transcript count, and the scrollable spell card list (with empty state).
 */
export default function SpellCodex({
  spells,
  selectedSpell,
  onSelectSpell,
  searchQuery,
  onSearchQueryChange,
  selectedDifficulty,
  onSelectDifficulty,
}: SpellCodexProps) {
  return (
    <section data-chrome className="order-2 lg:order-1 lg:col-span-5 lg:row-span-1 lg:min-h-0 flex flex-col gap-4 min-h-0">
      {/* Codex Search & Filters */}
      <div className="p-4 bg-[#1C0F25]/90 rounded-2xl border border-amber-900/30 flex flex-col gap-3 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <span className="font-display font-medium text-[13px] text-amber-400 tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-500" />
            BOILING ISLES SPELLBOOK
          </span>
          <span className="font-mono text-[10px] text-amber-200/40">
            {spells.length} Transcripts
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            id="spell-search-input"
            aria-label="Search spells"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search paths... ( / )"
            className="w-full bg-[#110917] border border-amber-900/30 focus:border-amber-500/50 rounded-lg pl-9 pr-4 py-2 text-xs text-amber-100 placeholder-amber-200/30 font-serif outline-none transition-all"
          />
        </div>

        <div role="group" aria-label="Filter spells by difficulty" className="flex flex-wrap gap-1.5 pt-1">
          {DIFFICULTY_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onSelectDifficulty(level)}
              aria-pressed={selectedDifficulty === level}
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono tracking-wide transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                selectedDifficulty === level
                  ? 'bg-amber-400/20 text-amber-300 border-amber-500/40 font-semibold'
                  : 'bg-[#110917]/80 text-amber-200/50 border-transparent hover:border-amber-900/40 hover:text-amber-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Spell Cards List */}
      <div className="flex-grow overflow-y-auto max-h-[550px] lg:max-h-none pr-1 flex flex-col gap-2.5 custom-scrollbar">
        {spells.length === 0 ? (
          <div className="p-8 text-center bg-[#1C0F25]/40 rounded-xl border border-amber-900/20 flex flex-col items-center justify-center gap-3">
            <Compass className="w-8 h-8 text-amber-600/30 animate-spin" aria-hidden="true" />
            <p className="font-serif italic text-xs text-amber-200/40">
              No overlapping glyph spells discovered. Check the archives!
            </p>
          </div>
        ) : (
          spells.map((spell) => (
            <SpellCard
              key={spell.id}
              spell={spell}
              selected={selectedSpell?.id === spell.id}
              onSelect={onSelectSpell}
            />
          ))
        )}
      </div>
    </section>
  );
}
