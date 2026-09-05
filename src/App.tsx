/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useMemo, useState } from 'react';
import { SPELLS_DATABASE } from './core/spells';
import type { Spell } from './core/types';
import MagicCanvas from './components/MagicCanvas';
import Header from './components/ui/Header';
import SpellCodex from './components/ui/SpellCodex';
import SpellDetailPanel from './components/ui/SpellDetailPanel';
import ModeTabs from './components/ui/ModeTabs';
import CastStatusBar from './components/ui/CastStatusBar';
import HistoryLog from './components/ui/HistoryLog';
import Footer from './components/ui/Footer';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useCastHistory } from './hooks/useCastHistory';

export default function App() {
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(SPELLS_DATABASE[0]);
  const [practiceMode, setPracticeMode] = useLocalStorage<boolean>(
    'tgg.practiceMode',
    true,
    {
      encode: (value) => (value ? '1' : '0'),
      decode: (raw) => raw === '1',
    },
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('All');
  const [isMuted, setIsMuted] = useLocalStorage<boolean>(
    'tgg.muted',
    false,
    {
      encode: (value) => (value ? '1' : '0'),
      decode: (raw) => raw === '1',
    },
  );

  const { castHistory, lastCastedResult, handleSpellRecognized, handleFizzle, clearHistory } = useCastHistory();

  const enterTrace = useCallback(() => {
    setPracticeMode(true);
  }, [setPracticeMode]);

  const enterSandbox = useCallback(() => {
    setPracticeMode(false);
    setSelectedSpell(null); // Clear active tracer phantom
  }, [setPracticeMode]);

  const toggleMute = useCallback(() => {
    setIsMuted((v) => !v);
  }, [setIsMuted]);

  // Global shortcuts: M mute, T trace, S sandbox, / focus search, Esc clear
  const shortcutHandlers = useMemo(
    () => ({ onToggleMute: toggleMute, onTrace: enterTrace, onSandbox: enterSandbox }),
    [toggleMute, enterTrace, enterSandbox],
  );
  useKeyboardShortcuts(shortcutHandlers);

  // Filter spells on search queries
  const filteredSpells = useMemo(() => {
    return SPELLS_DATABASE.filter((spell) => {
      const matchesSearch =
        spell.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spell.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDifficulty =
        selectedDifficulty === 'All' ||
        spell.difficulty === selectedDifficulty;

      return matchesSearch && matchesDifficulty;
    });
  }, [searchQuery, selectedDifficulty]);

  return (
    <div className="min-h-screen bg-[#130B1B] text-amber-100/90 antialiased flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Skip link: first tab stop, jumps to drawing canvas */}
      <a
        href="#workspace"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-lg focus:bg-amber-950 focus:text-amber-200 focus:border focus:border-amber-500/60 focus:text-xs focus:font-mono"
      >
        Skip to drawing canvas
      </a>

      <Header muted={isMuted} onToggleMute={toggleMute} />

      {/* Main Panel Workshop Layout */}
      <main className="flex-grow p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] lg:h-[calc(100vh-6rem)] gap-6 items-stretch">
        {/* Left Column: Codex/Spellbook (5 cols) but rendered SECOND on mobile to avoid scrolling past */}
        <SpellCodex
          spells={filteredSpells}
          selectedSpell={selectedSpell}
          onSelectSpell={setSelectedSpell}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          selectedDifficulty={selectedDifficulty}
          onSelectDifficulty={setSelectedDifficulty}
        />

        {/* Right Column: Interaction Arena (7 cols) but rendered FIRST on mobile to bypass scrolling */}
        <section id="workspace" className="order-1 lg:order-2 lg:col-span-7 lg:row-span-1 lg:min-h-0 lg:overflow-y-auto custom-scrollbar flex flex-col gap-5 min-h-0">
          {/* Spell details, info panel */}
          {selectedSpell && (
            <SpellDetailPanel spell={selectedSpell} />
          )}

          {/* Interactive Workspace Area */}
          <div className="flex-grow lg:min-h-0 flex flex-col gap-4">
            {/* Mode selection Bar */}
            <ModeTabs
              practiceMode={practiceMode}
              onTrace={enterTrace}
              onSandbox={enterSandbox}
              selectedSpell={selectedSpell}
            />

            {/* Active Drawing Canvas Frame */}
            <MagicCanvas
              currentSpell={selectedSpell}
              practiceMode={practiceMode}
              onSpellRecognized={handleSpellRecognized}
              onFizzle={handleFizzle}
              isMuted={isMuted}
            />

            <CastStatusBar result={lastCastedResult} />

            {/* History Logger drawer */}
            <HistoryLog items={castHistory} onClear={clearHistory} />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
