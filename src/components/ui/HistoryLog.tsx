import { History } from 'lucide-react';
import type { CastEntry } from '../../hooks/useCastHistory';
import Spectrograph from './Spectrograph';

export interface HistoryLogProps {
  items: CastEntry[];
  onClear: () => void;
}

/** "Glyph Resonance Chronicles" drawer: per-cast cards with glow, match chip, spectrograph. */
export default function HistoryLog({ items, onClear }: HistoryLogProps) {
  if (items.length === 0) {return null;}

  return (
    <div data-chrome className="p-4 bg-[#1C0F25]/60 border border-amber-900/35 rounded-2xl flex flex-col gap-3.5 shadow-inner">
      <div className="flex items-center justify-between text-amber-500/60 font-mono text-[10px] tracking-wider uppercase">
        <span className="flex items-center gap-1.5 font-semibold">
          <History className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
          Glyph Resonance Chronicles
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear cast history"
          className="hover:text-rose-400 transition-all flex items-center gap-1 cursor-pointer font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:rounded"
        >
          Wipe Inscription Log
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => {
          const isSuccess = item.status === 'success';
          const scores = item.scores ?? { light: 0, ice: 0, plant: 0, fire: 0, circle: 0 };

          return (
            <div
              key={item.id}
              className={`p-3 bg-[#110917]/90 border rounded-xl flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-200 hover:border-amber-500/30 ${
                isSuccess ? 'border-amber-900/35' : 'border-rose-900'
              }`}
            >
              {/* Glow effect matching success state */}
              <div
                className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-[24px] pointer-events-none opacity-[0.06] ${
                  isSuccess ? 'bg-amber-400' : 'bg-rose-500'
                }`}
              />

              {/* Top Metadata Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="text-left font-serif">
                  <span className={`font-display font-medium text-xs block ${
                    isSuccess ? 'text-amber-300' : 'text-rose-400 font-semibold'
                  }`}>
                    {item.name}
                  </span>
                  <span className="text-[10px] text-amber-200/45 font-mono">
                    {item.timestamp} • {isSuccess ? 'Successfully Cast' : 'Failed Attempt'}
                  </span>
                </div>

                <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  isSuccess
                    ? 'bg-amber-900 text-amber-300 border border-amber-800/40'
                    : 'bg-rose-900 text-rose-300 border border-rose-900/30'
                }`}>
                  {item.score}% Match
                </div>
              </div>

              {/* Detailed 5-Glyph Resonance Spectrograph Grid */}
              <Spectrograph scores={scores} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
