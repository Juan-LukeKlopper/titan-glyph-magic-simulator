import { useCallback, useState } from 'react';
import { SPELLS_DATABASE } from '../core/spells';

export type CastStatus = 'success' | 'fizzle';

export interface CastEntry {
  id: string;
  name: string;
  score: number;
  timestamp: string;
  status: CastStatus;
  scores?: Record<string, number>;
}

export interface CastResult {
  name: string;
  score: number;
  status: CastStatus;
}

const HISTORY_LIMIT = 6; // keep last 6 entries

function formatTimestamp(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function makeEntry(
  name: string,
  score: number,
  status: CastStatus,
  scores?: Record<string, number>,
): CastEntry {
  return {
    id: Math.random().toString(),
    name,
    score,
    timestamp: formatTimestamp(),
    status,
    scores,
  };
}

/**
 * Owns the Glyph Resonance Chronicles history: keeps the last 6 cast entries,
 * the most recent result shown in the status bar, and the recognizer callbacks
 * that record successes and fizzles (incl. the "Faulty X Attempt" naming).
 */
export function useCastHistory() {
  const [castHistory, setCastHistory] = useState<CastEntry[]>([]);
  const [lastCastedResult, setLastCastedResult] = useState<CastResult | null>(null);

  const handleSpellRecognized = useCallback(
    (spellId: string, accuracy: number, scores?: Record<string, number>) => {
      const spell = SPELLS_DATABASE.find((s) => s.id === spellId);
      if (!spell) {return;}

      setLastCastedResult({ name: spell.name, score: accuracy, status: 'success' });
      setCastHistory((prev) => [
        makeEntry(spell.name, accuracy, 'success', scores),
        ...prev.slice(0, HISTORY_LIMIT - 1),
      ]);
    },
    [],
  );

  const handleFizzle = useCallback((scores?: Record<string, number>) => {
    setLastCastedResult({ name: 'Unrecognized Glyph Scribble', score: 0, status: 'fizzle' });

    let highestElement = 'unknown';
    let highestScore = 0;
    if (scores) {
      Object.entries(scores).forEach(([el, val]) => {
        if (val > highestScore) {
          highestScore = val;
          highestElement = el;
        }
      });
    }

    const name =
      highestElement !== 'unknown' && highestScore > 0.15
        ? `Faulty ${highestElement.charAt(0).toUpperCase() + highestElement.slice(1)} Attempt`
        : 'Unrecognized Scribble';

    const scorePct = Math.round(highestScore * 100);

    setCastHistory((prev) => [
      makeEntry(name, scorePct, 'fizzle', scores),
      ...prev.slice(0, HISTORY_LIMIT - 1),
    ]);
  }, []);

  const clearHistory = useCallback(() => {
    setCastHistory([]);
  }, []);

  return { castHistory, lastCastedResult, handleSpellRecognized, handleFizzle, clearHistory };
}
