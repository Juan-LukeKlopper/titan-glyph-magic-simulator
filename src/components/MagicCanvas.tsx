/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Sparkles } from 'lucide-react';
import type { ElementType, Point, Spell, Stroke } from '../core/types';
import { recognizeGesture, scoreAgainstTarget } from '../core/recognizer';
import { mystSynth } from '../core/audio/synth';
import { SPELLS_DATABASE } from '../core/spells';

// Engine modules (the decomposed MagicCanvas internals).
import type { EffectLayer } from '../effects';
import { createEffectLayer, EFFECT_SPELL_MAP } from '../effects';
import { TRACE_CAST_THRESHOLD, RECOGNIZE_THRESHOLD_DISPLAY, CAST_TRANSITION_MS } from '../engine/constants';
import { activateTriggerSpell, spawnActivationBurst } from '../engine/cast';
import { createSimState } from '../engine/sim/state';
import type { SimState } from '../engine/sim/state';
import { stepSimulation } from '../engine/sim/loop';
import { resizeCanvasToBox } from '../engine/canvas2d';
import {
  beginEntityDrag,
  cancelActiveStroke,
  clientToCanvasPoint,
  findDraggableEntity,
  handleShatterClick,
  moveDraggedEntity,
  releasePointerCapture,
} from '../engine/input';
import { clearSimulationWorld, releaseDrag } from '../engine/sim/world';

/**
 * Trace-mode auto-cast: minimum raw similarity to the practiced glyph required
 * to compile. (Also used by the sandbox Activate path.)
 * Kept alongside the component because recognition policy is UI behavior.
 */

/**
 * Props for the interactive glyph-drawing canvas.
 *
 * `currentSpell` is the active selection (used as the Trace-mode target, or
 * null in free-draw). `practiceMode` toggles between guided tracing and
 * sandbox free-draw. Cast outcomes are reported up via the callbacks.
 */
interface MagicCanvasProps {
  currentSpell: Spell | null;
  practiceMode: boolean;
  onSpellRecognized: (spellId: string, accuracy: number, scores?: Record<string, number>) => void;
  onFizzle: (scores?: Record<string, number>) => void;
  isMuted: boolean;
}

export default function MagicCanvas({
  currentSpell,
  practiceMode,
  onSpellRecognized,
  onFizzle,
  isMuted,
}: MagicCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [completedStrokes, setCompletedStrokes] = useState<Stroke[]>([]);

  // Entity/Particle simulation + RAF bookkeeping (one mutable world per mount)
  const simRef = useRef<SimState | null>(null);
  if (simRef.current === null) {
    simRef.current = createSimState();
  }
  const animationFrameRef = useRef<number | null>(null);
  const dprRef = useRef(1);
  const effectLayerRef = useRef<EffectLayer | null>(null);

  // Invisibility duration / breath meter (ref-set state sync happens inside the RAF)
  const [breathMeter, setBreathMeter] = useState(100);
  const [isInvisActive, setIsInvisActive] = useState(false);
  const isInvisSyncedRef = useRef(false);

  // Render-loop mirrors: the RAF effect mounts once and reads these refs,
  // so per-pointer-move state churn never tears down/rebuilds the simulation loop.
  const strokesRenderRef = useRef<{ completed: Stroke[]; current: Point[] }>({ completed: [], current: [] });
  const currentSpellRef = useRef<Spell | null>(currentSpell);
  const practiceModeRef = useRef(practiceMode);
  const castingTransRef = useRef(false);

  // The RAF never calls React setState directly: this callback mirrors the
  // sim's invisibility flag into React ONLY when it actually changed, and it
  // is only ever invoked from inside the RAF (all writes are guarded here, so
  // invisibility can never leak out after unmount). When the flag flips OFF
  // the breath gauge is refilled here (async context, not an effect body) —
  // mirroring the pre-split behavior where deactivating Invisibility reset
  // the meter to full.
  const syncIsInvisFromRaf = useCallback((active: boolean) => {
    if (active !== isInvisSyncedRef.current) {
      isInvisSyncedRef.current = active;
      setIsInvisActive(active);
      if (!active) {
        setBreathMeter(100);
      }
    }
  }, []);

  /** Logical (CSS-pixel) box of the current backing store. */
  const logicalBox = useCallback((): { w: number; h: number } => {
    const canvas = canvasRef.current;
    const dpr = dprRef.current || 1;
    return canvas
      ? { w: Math.round(canvas.width / dpr), h: Math.round(canvas.height / dpr) }
      : { w: 0, h: 0 };
  }, []);

  /** Logical CSS-pixel height of the canvas (for floor-anchored spawns). */
  const logicalHeight = useCallback((): number => logicalBox().h, [logicalBox]);

  // Setup/Sync Synth mute
  useEffect(() => {
    mystSynth.setMute(isMuted);
  }, [isMuted]);

  // Adjust canvas bounds on screen change (Hi-DPI, capped at 2x)
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) {return;}

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {return;}

      dprRef.current = resizeCanvasToBox(canvas, rect.width, rect.height);
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) {observer.observe(containerRef.current);}

    return () => observer.disconnect();
  }, []);

  // Mirror drawing + spell state into refs for the mount-once loop
  useEffect(() => {
    strokesRenderRef.current = { completed: completedStrokes, current: currentStroke };
    const sim = simRef.current;
    if (sim) {
      sim.strokes = { completed: completedStrokes, current: currentStroke };
    }
  }, [completedStrokes, currentStroke]);

  useEffect(() => {
    currentSpellRef.current = currentSpell;
    practiceModeRef.current = practiceMode;
  }, [currentSpell, practiceMode]);

  // Lazily construct the shared WebGL effect layer (appended to the container
  // by the shader agent's createEffectLayer; pointer-events none).
  const getEffectLayer = useCallback((): EffectLayer | null => {
    if (effectLayerRef.current) {return effectLayerRef.current;}
    if (!containerRef.current) {return null;}
    effectLayerRef.current = createEffectLayer(containerRef.current);
    return effectLayerRef.current;
  }, []);

  // Dispose the effect layer on unmount (alongside the RAF cancel below).
  useEffect(() => {
    return () => {
      effectLayerRef.current?.dispose();
      effectLayerRef.current = null;
    };
  }, []);

  // Seed teleport portals when the teleportation spell is active
  useEffect(() => {
    const sim = simRef.current;
    const canvas = canvasRef.current;
    if (!sim || !canvas) {return;}

    // Dynamic Seed portals (ONLY if teleportation spell is active, otherwise remove from current entities to fix top-left bug)
    if (currentSpell?.id === 'teleportation') {
      const existingPortals = sim.entities.filter((e) => e.type === 'portal');
      if (existingPortals.length === 0 && canvas.width > 0) {
        sim.entities.push({
          id: 'portal-a',
          type: 'portal',
          x: canvas.width * 0.3,
          y: canvas.height * 0.5,
          size: 55,
          color: '#FD79A8',
          data: { portalTarget: 'portal-b', angle: 0 },
        });
        sim.entities.push({
          id: 'portal-b',
          type: 'portal',
          x: canvas.width * 0.7,
          y: canvas.height * 0.5,
          size: 55,
          color: '#74B9FF',
          data: { portalTarget: 'portal-a', angle: 0 },
        });
      }
    } else {
      // If we are tracing or sandbox-acting any other spell, remove standard portals
      if (practiceMode) {
        sim.entities = sim.entities.filter((e) => e.type !== 'portal');
      }
    }
  }, [currentSpell, practiceMode]);

  // Main high-performance simulation Loop (60FPS Physics, collisions, rendering)
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) {return;}

    const updateAndDraw = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameRef.current = requestAnimationFrame(updateAndDraw);
        return;
      }

      castingTransRef.current = sim.castingTrans;

      stepSimulation(
        canvas,
        dprRef.current,
        sim,
        currentSpellRef.current,
        practiceModeRef.current,
        syncIsInvisFromRaf
      );

      animationFrameRef.current = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      if (animationFrameRef.current) {cancelAnimationFrame(animationFrameRef.current);}
      animationFrameRef.current = null;
    };
  }, [syncIsInvisFromRaf]);

  // Handle ticking the Invisibility breath gauge. The gauge only ever drains
  // while Invisibility is active; refilling happens at the moment the sim flag
  // flips off (in syncIsInvisFromRaf) rather than as a sync setState inside
  // this effect, so no cascading render is triggered by the effect body.
  useEffect(() => {
    if (!isInvisActive) {
      return;
    }
    const breathTimer = setInterval(() => {
      setBreathMeter((prev) => {
        if (prev <= 1.5) {
          // Breath ran out! Break Invisibility
          const sim = simRef.current;
          if (sim) {sim.isInvisActive = false;}
          syncIsInvisFromRaf(false);
          mystSynth.playFizzle();
          return 100;
        }
        return prev - 1.5;
      });
    }, 100);
    return () => {
      clearInterval(breathTimer);
    };
  }, [isInvisActive, syncIsInvisFromRaf]);

  // While the invisibility shroud is active, fade the whole UI chrome so only
  // the breath gauge stays visible; everything returns the moment the shroud
  // drops (breath runs out, or the cast breaks).
  useEffect(() => {
    if (isInvisActive) {
      document.body.dataset.shroud = 'active';
    } else {
      delete document.body.dataset.shroud;
    }
    return () => {
      delete document.body.dataset.shroud;
    };
  }, [isInvisActive]);

  // --- Somatic Spell Trigger Activation Parser (Ast Ast compiling) ---
  const activateSpell = useCallback(
    (
      recognizedType: ElementType,
      accuracyOverride?: number,
      scores?: Record<string, number>,
      options?: { notify?: boolean },
      strokes?: Stroke[]
    ) => {
      const sim = simRef.current;
      const canvas = canvasRef.current;
      if (!sim || !canvas) {return;}

      // Centroid of drawn geometry becomes magic origin point.
      // Strokes are passed explicitly to avoid stale render-time closures.
      const sourceStrokes = strokes ?? sim.strokes.completed;
      const allCapturedPoints = sourceStrokes.flatMap((s) => s.points);
      let sumX = 0;
      let sumY = 0;
      let totalPointsCount = 0;

      if (allCapturedPoints.length === 0) {
        // Setup fallback coordinates to center of screen (CSS-pixel space)
        const { w, h } = logicalBox();
        sumX = w / 2;
        sumY = h / 2;
      } else {
        allCapturedPoints.forEach((p) => {
          sumX += p.x;
          sumY += p.y;
          totalPointsCount++;
        });
        sumX /= totalPointsCount;
        sumY /= totalPointsCount;
      }

      const castX = sumX;
      const castY = sumY;

      // Determine what exact spell compiles
      // Is it a guided trace spell? Use currentSpell. Otherwise classify via gesture
      let spellToCast = currentSpellRef.current;
      if (!practiceModeRef.current) {
        // Find database item which implements element
        const matchingSpell = SPELLS_DATABASE.find(
          (s) => s.primaryElement === recognizedType && s.type === 'primitive'
        );
        if (matchingSpell) {spellToCast = matchingSpell;}
      }

      if (!spellToCast || spellToCast.id === 'unknown') {
        mystSynth.playFizzle();
        onFizzle();
        return;
      }

      // Interactive Trigger Success Effects
      sim.castingTrans = true;
      castingTransRef.current = true;
      window.setTimeout(() => {
        const world = simRef.current;
        if (world) {world.castingTrans = false;}
        castingTransRef.current = false;
      }, CAST_TRANSITION_MS);

      // Dynamic Sound Synthesis: a distinct timbre per glyph element
      mystSynth.playCast(spellToCast.primaryElement);

      // Notify parent widget of score (instant cast notifies itself beforehand)
      if (options?.notify !== false) {
        onSpellRecognized(spellToCast.id, accuracyOverride ?? 92, scores);
      }

      // Activation burst: radial sparks + expanding shockwave ring at the cast origin
      spawnActivationBurst(sim, castX, castY, spellToCast.color);

      // Effects-layer seam: when the WebGL layer accepts the spell, the legacy
      // 2D spawner for that case is skipped (sound + notify + burst above ran).
      const box = logicalBox();
      activateTriggerSpell(sim, spellToCast, { x: castX, y: castY, width: box.w, height: box.h }, {
        layer: getEffectLayer(),
        kindFor: (spellId: string) => EFFECT_SPELL_MAP[spellId],
      });

      // State-only spell side effects that are not entity spawns:
      if (spellToCast.id === 'invisibility') {
        sim.isInvisActive = true;
        syncIsInvisFromRaf(true);
      }
    },
    [logicalBox, onSpellRecognized, onFizzle, syncIsInvisFromRaf, getEffectLayer]
  );

  // Release the pointer capture taken on pointerdown; harmless if none held.
  const releasePointerCaptureFor = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {releasePointerCapture(canvas, e.pointerId);}
  };

  // --- Mid-stroke interruption safety ---
  // Phone calls, notification banners, and palm rejection fire 'pointercancel'
  // or steal window focus mid-gesture. Without cleanup, isDrawing sticks true
  // and the half-finished stroke lingers forever. Aborting drops the gesture
  // silently: no cast, no score, no sound, as if it never happened.
  const cancelActiveStrokeLocal = useCallback(() => {
    const sim = simRef.current;
    if (sim) {
      cancelActiveStroke(sim);
      sim.strokes.current = [];
    }
    strokesRenderRef.current = { ...strokesRenderRef.current, current: [] };
    setIsDrawing(false);
    setCurrentStroke([]);
  }, []);

  useEffect(() => {
    const handleWindowBlur = () => {
      const sim = simRef.current;
      if (!sim) {return;}
      if (sim.dragEntityId || sim.strokes.current.length > 0) {
        cancelActiveStrokeLocal();
      }
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [cancelActiveStrokeLocal]);

  const handlePointerCancel = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    releasePointerCaptureFor(e);
    cancelActiveStrokeLocal();
  };

  // --- Mouse & Draw Captured event listeners (Touch compatibility) ---
  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !sim) {return;}
    // Track the pointer even when it leaves the canvas mid-stroke (a finger
    // drifting over the tool rails). Some browsers throw for mouse pointers.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture unavailable: default hit-target tracking still applies.
    }

    const rect = canvas.getBoundingClientRect();
    const pt = clientToCanvasPoint(e.clientX, e.clientY, rect);
    const x = pt.x;
    const y = pt.y;

    sim.lastPointer = { x, y };

    // Interactive Dragging detection: Clicked on a portable light sphere or portal node?
    // (Matches the monolith: the draggable hit-test only ever returns
    // light_sphere/portal — petrified light spheres are still draggable and are
    // NEVER shatterable; only ice_pillar shatters, via the hit-test below.)
    const clickedEntity = findDraggableEntity(sim, x, y);
    if (clickedEntity) {
      if (clickedEntity.type === 'portal' || clickedEntity.type === 'light_sphere') {
        beginEntityDrag(sim, clickedEntity.id);
        return;
      }
    }

    // Shatter ice pillars on click (plain or petrified)
    if (handleShatterClick(sim, x, y, logicalHeight())) {
      return;
    }

    // Start drawing
    setIsDrawing(true);
    setCurrentStroke([{ x, y, t: Date.now() }]);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !sim) {return;}

    const rect = canvas.getBoundingClientRect();
    const pt = clientToCanvasPoint(e.clientX, e.clientY, rect);
    const x = pt.x;
    const y = pt.y;

    sim.lastPointer = { x, y };

    // Move dragged objects
    if (sim.dragEntityId) {
      moveDraggedEntity(sim, x, y);
      return;
    }

    if (!isDrawing) {return;}

    const prevPt = currentStroke[currentStroke.length - 1];
    const d = prevPt ? Math.sqrt((prevPt.x - x) ** 2 + (prevPt.y - y) ** 2) : 0;

    // Add point if moved at least 2 pixels to optimize points count
    if (d > 2) {
      setCurrentStroke((prev) => [...prev, { x, y, t: Date.now() }]);
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const sim = simRef.current;
    if (!sim) {return;}

    if (sim.dragEntityId) {
      releaseDrag(sim);
      return;
    }

    if (!isDrawing) {return;}
    setIsDrawing(false);

    if (currentStroke.length < 3) {
      setCurrentStroke([]);
      return;
    }

    const newStroke: Stroke = {
      id: Math.random().toString(),
      points: currentStroke,
    };

    const nextStrokes = [...completedStrokes, newStroke];
    setCompletedStrokes(nextStrokes);
    setCurrentStroke([]);

    // Check if drawing has completed the trace or if we are free-drawing.
    // In practice/trace mode, compile spell when trace matches accuracy.
    // In Sandbox free-draw, compile immediately if they finished the geometric shape (or automatically if circle drawn!)
    // For comfort, let's allow they compile on clicking "Activate" OR auto-trigger if a completed closed circle is drawn
    if (practiceMode && currentSpell) {
      // Trace mode: analyze current trace accuracy using rotation-invariant matcher.
      // Auto-compile ONLY on genuine similarity to the practiced glyph.
      const res = recognizeGesture(nextStrokes);
      const targetScore = scoreAgainstTarget(nextStrokes, currentSpell.primaryElement);

      const matched =
        res.name === currentSpell.primaryElement || targetScore >= TRACE_CAST_THRESHOLD;

      if (matched) {
        // Honest accuracy derived from the raw target similarity, clamped for display
        const accuracy = Math.min(99, Math.max(50, Math.round(targetScore * 100)));

        setCompletedStrokes([]);
        activateSpell(
          currentSpell.primaryElement,
          accuracy,
          res.scores,
          undefined,
          nextStrokes
        );
      }
    }
  };

  // Explicit Activation trigger from Button Panel
  const compileSandboxSpells = () => {
    const sim = simRef.current;
    if (!sim) {return;}
    if (completedStrokes.length === 0) {
      mystSynth.playFizzle();
      onFizzle();
      return;
    }

    const res = recognizeGesture(completedStrokes);

    // Sync render refs eagerly so the mount-once RAF loop stops drawing the
    // consumed strokes before React re-renders.
    strokesRenderRef.current = { completed: [], current: [] };
    sim.strokes = { completed: [], current: [] };
    setCompletedStrokes([]);

    // Capture the pre-clear strokes once: scoring, accuracy grading and the cast
    // origin must all see the same drawing even after setCompletedStrokes([]).
    const strokesForScoring = completedStrokes;

    // Success requires an actual classification (never 'unknown')
    let success = false;
    let finalElement: ElementType = 'light';
    if (practiceMode && currentSpell) {
      finalElement = currentSpell.primaryElement;
      if (res.name === currentSpell.primaryElement) {
        success = true;
      } else {
        const targetScore = scoreAgainstTarget(strokesForScoring, currentSpell.primaryElement);
        if (targetScore >= TRACE_CAST_THRESHOLD) {
          success = true;
        }
      }
    } else if (res.name !== 'unknown') {
      success = true;
      finalElement = res.name as ElementType;
    }

    if (success) {
      // Honest accuracy: in trace mode grade against the practiced glyph's own
      // templates; in sandbox the global classifier score is already the truth.
      const accuracy =
        practiceMode && currentSpell
          ? Math.max(
              Math.round(res.score * 100),
              Math.round(scoreAgainstTarget(strokesForScoring, currentSpell.primaryElement) * 100),
            )
          : Math.round(res.score * 100);
      activateSpell(finalElement, accuracy, res.scores, undefined, strokesForScoring);
    } else {
      mystSynth.playFizzle();
      // Surface the target similarity so a NEAR-MISS trace (e.g. 53% vs the practiced
      // glyph) shows "Faulty <Element> Attempt" instead of a generic scribble. The
      // attempt WAS aimed at something. A confidently-recognized bare ring likewise
      // reports itself rather than reading as noise.
      const nearMissTarget =
        practiceMode && currentSpell
          ? scoreAgainstTarget(strokesForScoring, currentSpell.primaryElement)
          : 0;
      const primaryElement = currentSpell?.primaryElement ?? '';
      const scores =
        res.matchedTemplate === 'circle' && res.score >= RECOGNIZE_THRESHOLD_DISPLAY
          ? { ...res.scores, circle: Math.max(res.score, nearMissTarget) }
          : nearMissTarget > (res.scores?.[primaryElement] ?? 0)
            ? { ...res.scores, [primaryElement]: nearMissTarget }
            : res.scores;
      onFizzle(scores);
    }
  };

  // Tracing Auto-Cast Bypass / Demo Action
  const handleInstantCast = () => {
    const sim = simRef.current;
    if (!sim) {return;}
    if (!currentSpell) {return;}

    // Wipe any existing messy ink strokes first (sync render refs eagerly so
    // the mount-once RAF loop sees cleared strokes before React re-renders)
    strokesRenderRef.current = { completed: [], current: [] };
    sim.strokes = { completed: [], current: [] };
    setCompletedStrokes([]);
    setCurrentStroke([]);

    // Instantly play success audio/visual transitions
    mystSynth.playCast(currentSpell.primaryElement);
    sim.castingTrans = true;
    castingTransRef.current = true;
    window.setTimeout(() => {
      const world = simRef.current;
      if (world) {world.castingTrans = false;}
      castingTransRef.current = false;
    }, CAST_TRANSITION_MS);

    // Notify parent frame that spell triggered perfectly! (exactly once)
    onSpellRecognized(currentSpell.id, 100);

    // Launch element visualizer in the default central coordinates
    activateSpell(currentSpell.primaryElement, 100, undefined, {
      notify: false,
    });
  };

  const clearCanvas = () => {
    const sim = simRef.current;
    setCompletedStrokes([]);
    setCurrentStroke([]);
    strokesRenderRef.current = { completed: [], current: [] };
    if (sim) {
      clearSimulationWorld(sim);
      syncIsInvisFromRaf(false);
    }
  };

  return (
    <div
      ref={containerRef}
      data-shroud-surface
      className="relative w-full h-[60vh] lg:h-auto lg:flex-1 lg:min-h-[320px] bg-[#180E21] border border-amber-950 rounded-2xl overflow-hidden shadow-2xl group"
    >
      {/* Background active energy glow aura depending on invisibility shrouds */}
      <canvas
        id="glyph-canvas"
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-label="Glyph drawing canvas. Draw with a mouse, touch, or pen. Results are announced below."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={(e) => {
          // Allow Space/Enter to be non-destructive: keep canvas focus but do
          // nothing so keyboard users can pass through without triggering a cast.
          if (e.key === ' ' || e.key === 'Enter') {e.preventDefault();}
        }}
        data-chrome
        className="block w-full h-full cursor-crosshair touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-inset"
      />

      {/* Visually hidden live hint that the canvas is interactive */}
      <span className="sr-only" aria-live="polite">
        {isInvisActive
          ? 'Invisibility is active. Press M to mute, T for trace mode, or S for sandbox.'
          : 'Glyph canvas ready. Draw a glyph to cast.'}
      </span>

      {/* Rhythmic Invisibility Exhalation Breath Gauge */}
      {isInvisActive && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-72 bg-[#120816]/95 backdrop-blur-md rounded-full border border-amber-500/30 p-2 text-center select-none shadow-amber-500/20 shadow-lg flex items-center gap-3">
          <span id="breath-meter-label" className="font-mono text-[10px] text-amber-400 tracking-wider pl-2 uppercase font-medium">
            Lungs:
          </span>
          <div
            role="progressbar"
            aria-labelledby="breath-meter-label"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(breathMeter)}
            className="flex-grow bg-[#21152B] h-2 rounded-full overflow-hidden"
          >
            <div
              className="bg-gradient-to-r from-amber-500 to-rose-400 h-full transition-all duration-100 ease-linear"
              style={{ width: `${breathMeter}%` }}
            />
          </div>
          <span className="font-mono text-[9px] text-amber-300 pr-2">{Math.round(breathMeter)}s</span>
        </div>
      )}

      {/* Canvas Tool Rails */}
      <div data-chrome className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-center gap-2 sm:justify-between pointer-events-none">
        <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
          <button
            id="clear-canvas-btn"
            type="button"
            onClick={clearCanvas}
            className="px-3.5 py-2.5 min-h-[44px] min-w-[44px] bg-[#251532]/90 hover:bg-[#341F46] text-amber-200/90 hover:text-white rounded-lg border border-amber-900/50 hover:border-amber-700/60 transition-all text-xs font-mono tracking-wide flex items-center gap-1.5 shadow-lg shadow-black/30 cursor-pointer"
          >
            Wipe Ink
          </button>
          {completedStrokes.length > 0 && (
            <button
              id="undo-stroke-btn"
              type="button"
              onClick={() => {
                setCompletedStrokes((prev) => {
                  const next = prev.slice(0, -1);
                  const world = simRef.current;
                  if (world) {world.strokes = { completed: next, current: world.strokes.current };}
                  return next;
                });
              }}
              className="px-3.5 py-2.5 min-h-[44px] min-w-[44px] bg-[#251532]/90 hover:bg-[#341F46] text-amber-200/90 hover:text-white rounded-lg border border-amber-900/50 hover:border-amber-700/60 transition-all text-xs font-mono tracking-wide flex items-center gap-1.5 shadow-lg shadow-black/30 cursor-pointer"
            >
              Undo Stroke
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pointer-events-auto">
          {practiceMode && (
            <span className="hidden sm:inline-flex px-3 py-1.5 bg-[#251532]/90 border border-amber-800/40 text-amber-300 rounded-lg text-xs font-mono tracking-wider items-center gap-2 shadow-lg shadow-black/30 animate-pulse">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
              Guidelines Active
            </span>
          )}
          {practiceMode && (
            <button
              id="instant-cast-btn"
              type="button"
              onClick={handleInstantCast}
              className="px-3.5 py-2.5 min-h-[44px] min-w-[44px] bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-amber-100 rounded-lg border border-purple-500/40 hover:border-purple-400/50 transition-all text-xs font-mono tracking-wider flex items-center gap-1.5 shadow-lg shadow-black/30 cursor-pointer active:scale-95"
              title="Instantly manifest the active spellcast visual effects and entities!"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Instant Cast</span>
            </button>
          )}
          <button
            id="compile-spell-btn"
            type="button"
            onClick={compileSandboxSpells}
            disabled={completedStrokes.length === 0}
            className={`px-4 py-2.5 min-h-[44px] min-w-[44px] rounded-lg text-xs font-mono tracking-wider font-semibold transition-all shadow-lg flex items-center gap-1.5 ${
              completedStrokes.length > 0
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 border border-amber-400 active:scale-95 cursor-pointer'
                : 'bg-[#251532]/45 text-amber-300/30 border border-amber-900/40 cursor-not-allowed'
            }`}
          >
            Activate Glyph
          </button>
        </div>
      </div>

      {/* Floating Canvas Guide Note */}
      <span data-chrome className="hidden sm:inline absolute top-4 left-4 font-mono text-[9px] text-amber-200/40 tracking-wider select-none pointer-events-none uppercase">
        Boiling Isles Wild Magic Canvas Grid v2.1
      </span>
    </div>
  );
}
