import { forwardRef } from 'react';

export interface SpectrographProps {
  scores?: Record<string, number>;
}

/** Percent clamp: values <= 1 are treated as a 0..1 fraction, else raw 0..100. */
function getPercent(value: number | undefined): number {
  if (value === undefined) {return 0;}
  return Math.max(0, Math.min(100, Math.round(value <= 1 ? value * 100 : value)));
}

const BANDS = [
  { key: 'light', label: '☀️ Sun', bg: 'bg-yellow-950/10', border: 'border-yellow-900/10', labelColor: 'text-yellow-400/90', valueColor: 'text-yellow-300', track: 'bg-yellow-950/60', fill: 'bg-gradient-to-r from-yellow-500 to-yellow-300' },
  { key: 'ice', label: '❄️ Cold', bg: 'bg-cyan-950/15', border: 'border-cyan-900/10', labelColor: 'text-cyan-400/90', valueColor: 'text-cyan-300', track: 'bg-cyan-950/60', fill: 'bg-gradient-to-r from-cyan-500 to-cyan-300' },
  { key: 'plant', label: '🌿 Wild', bg: 'bg-emerald-950/10', border: 'border-emerald-900/10', labelColor: 'text-emerald-400/90', valueColor: 'text-emerald-300', track: 'bg-emerald-950/60', fill: 'bg-gradient-to-r from-emerald-500 to-emerald-300' },
  { key: 'fire', label: '🔥 Heat', bg: 'bg-rose-950/10', border: 'border-rose-900/10', labelColor: 'text-rose-400/90', valueColor: 'text-rose-300', track: 'bg-rose-950/60', fill: 'bg-gradient-to-r from-rose-500 to-rose-300' },
  { key: 'circle', label: '🛡️ Ring', bg: 'bg-amber-950/10', border: 'border-amber-900/10', labelColor: 'text-amber-400', valueColor: 'text-amber-300', track: 'bg-amber-950/60', fill: 'bg-gradient-to-r from-amber-500 to-amber-300' },
] as const;

/** The detailed 5-glyph resonance spectrograph grid (Sun / Cold / Wild / Heat / Ring). */
const Spectrograph = forwardRef<HTMLDivElement, SpectrographProps>(function Spectrograph(
  { scores },
  ref,
) {
  return (
    <div ref={ref} className="grid grid-cols-5 gap-1 pt-2.5 mt-2 border-t border-amber-900/10">
      {BANDS.map((band) => {
        const pct = getPercent(scores?.[band.key]);
        return (
          <div key={band.key} className={`flex flex-col gap-0.5 items-center ${band.bg} p-1 rounded border ${band.border}`}>
            <span className={`${band.labelColor} font-mono text-[8px] tracking-tighter uppercase font-medium`}>{band.label}</span>
            <span className={`font-mono font-bold ${band.valueColor} text-[9px]`}>{pct}%</span>
            <div className={`w-full h-0.5 ${band.track} rounded-full overflow-hidden mt-0.5`}>
              <div className={`h-full ${band.fill} relative`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default Spectrograph;
