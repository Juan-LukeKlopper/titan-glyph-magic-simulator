import { AlertTriangle, HelpCircle, Info, Sparkles } from 'lucide-react';
import type { CastResult } from '../../hooks/useCastHistory';

export interface CastStatusBarProps {
  result: CastResult | null;
}

/**
 * Live "compiler" status line (aria-live region) showing the last cast
 * result, the similarity-ratio chip, and the in-world mechanics hint card.
 */
export default function CastStatusBar({ result }: CastStatusBarProps) {
  return (
    <>
      {/* Live Compiler logs output lines */}
      <div data-chrome role="status" aria-live="polite" aria-atomic="true" className="p-3 bg-[#1C0F25] border border-amber-900/30 rounded-xl flex items-center justify-between text-left gap-3 relative overflow-hidden group shadow-lg">
        <div className="flex items-center gap-2.5 max-w-full">
          <div aria-hidden="true" className="w-8 h-8 rounded-lg bg-[#110917] border border-amber-900/40 flex items-center justify-center flex-shrink-0 animate-pulse">
            {result?.status === 'success' ? (
              <Sparkles className="w-4 h-4 text-amber-400" />
            ) : result?.status === 'fizzle' ? (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            ) : (
              <HelpCircle className="w-4 h-4 text-amber-600/60" />
            )}
          </div>
          <div className="min-w-0 font-serif">
            <span className="font-mono text-[9px] text-amber-500/60 tracking-wider block uppercase">Arcane Inscription Response:</span>
            <p className="font-serif text-xs text-amber-100 truncate font-semibold">
              {result ? (
                result.status === 'success' ? (
                  <>
                    Successfully conjured {result.name}
                    {result.score > 0 && ` with ${result.score}% match`}.
                  </>
                ) : (
                  <span className="text-rose-400 font-serif italic">{result.name} did not resolve to a spell.</span>
                )
              ) : (
                'The magical parchment is blank. Trace or scribble glyphs to conjure...'
              )}
            </p>
          </div>
        </div>

        {result && result.score > 0 && (
          <div className="text-right flex-shrink-0 bg-[#110917] border border-amber-900/30 px-2.5 py-1 rounded font-mono">
            <span className="text-[10px] text-amber-600/60 block">Similarity Ratio:</span>
            <div className="text-[11px] font-bold text-amber-400">{result.score}% Match</div>
          </div>
        )}
      </div>

      {/* In-world explanation instructions card */}
      <div data-chrome className="bg-[#1C0F25]/40 rounded-xl border border-amber-900/20 p-3.5 text-left text-xs text-amber-200/60 flex items-start gap-2.5 shadow-inner">
        <Info className="w-4 h-4 text-amber-500/60 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed font-serif">
          <strong className="text-amber-300 font-serif">Witchcraft Mechanics:</strong> Hold drag to draw magical golden ink lines on the obsidian pad. Click to shatter active Ice structures, and drag floating Light spheres or Teleportation portal boundaries around to warp gravity!
        </div>
      </div>
    </>
  );
}
