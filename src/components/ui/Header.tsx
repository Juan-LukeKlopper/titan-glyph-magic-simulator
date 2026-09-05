import { Volume2, VolumeX, Wand2 } from 'lucide-react';

export interface HeaderProps {
  muted: boolean;
  onToggleMute: () => void;
}

/** Mystical alchemical header: title, "Wild Magic" tag, mute toggle and pulse status. */
export default function Header({ muted, onToggleMute }: HeaderProps) {
  return (
    <header data-chrome className="border-b border-amber-900/30 bg-[#1D1126]/90 backdrop-blur-md px-4 md:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-900/20 border border-amber-400/45">
          <Wand2 className="w-5 h-5 text-slate-950 stroke-[2]" aria-hidden="true" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-medium text-lg tracking-wide text-amber-400">
              Titan's Glyph Grimoire
            </h1>
            <span className="text-[10px] bg-amber-950/80 text-amber-300 font-mono px-2.5 py-0.5 rounded-full border border-amber-700/35 font-medium tracking-tight">
              Wild Magic
            </span>
          </div>
          <p className="text-xs text-amber-200/60 font-serif italic tracking-wide">
            An ancient collection of elemental glyphs and synthesized magic from the Boiling Isles
          </p>
        </div>
      </div>

      {/* Global Controls */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={muted ? 'Unmute spell sounds' : 'Mute spell sounds'}
          aria-pressed={muted}
          className="p-2 bg-[#2D1C3A] hover:bg-[#3E2750] text-amber-200/80 hover:text-white rounded-lg border border-amber-900/40 hover:border-amber-700/40 transition-all flex items-center gap-2 text-xs font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          title={muted ? 'Unmute Spell Chimes' : 'Mute Spell Chimes'}
        >
          {muted ? (
            <>
              <VolumeX className="w-4 h-4 text-rose-400" />
              <span>Muted</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>Audio Aura</span>
            </>
          )}
        </button>

        <div className="hidden lg:flex items-center gap-1 text-[10px] text-amber-600/70 font-mono uppercase tracking-widest">
          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-ping" aria-hidden="true" />
          <span>Wild Magic Pulse Strong</span>
        </div>
      </div>
    </header>
  );
}
