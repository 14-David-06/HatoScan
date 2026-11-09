'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import heroHerd from '../assets/hero-herd.webp';
import { HERO_HERD_MARKS } from '../assets/hero-herd.marks';
import { cornersPath, nearestMark, type MarkBox } from '../assets/marks';
import { RollingNumber } from '../review/rolling-number';
import { RefreshIcon, ShieldCheckIcon } from '../ui/icons';
import {
  addAtMs,
  appearAtMs,
  confirmedTotal,
  DISCARD_AT_MS,
  frameAt,
  SCAN_MS,
  SCAN_START_MS,
  type HeroFrame,
  type HeroScript,
} from './hero-timeline';

const { width: W, height: H } = HERO_HERD_MARKS;

/** Dos búfalas metidas en el charco: el modelo no las ve y la persona las añade. */
const MISSED = [nearestMark(HERO_HERD_MARKS, 1566, 978), nearestMark(HERO_HERD_MARKS, 1518, 1142)];
/** La sombra de un árbol, que el modelo toma por un animal: la persona la descarta. */
const FALSE_POSITIVE: MarkBox = { x: 335, y: 556, w: 96, h: 60 };

const SCRIPT: HeroScript = {
  imageHeight: H,
  proposed: [...HERO_HERD_MARKS.animals.filter((a) => !MISSED.includes(a)), FALSE_POSITIVE],
  falsePositive: FALSE_POSITIVE,
  missed: MISSED,
};
const TOTAL = confirmedTotal(SCRIPT);
const FINAL: HeroFrame = { stage: 'done', count: TOTAL };
/** Margen de las esquinas alrededor del animal, en píxeles de la imagen. */
const PAD = 10;

const STAGE_LABEL = {
  scan: 'Propuestas del modelo',
  review: 'Una persona revisa',
  done: 'Total confirmado',
} as const;

/** `play`: la secuencia corre; `still`: todo en su estado final (movimiento reducido). */
type Mode = 'idle' | 'play' | 'still';

const at = (ms: number) => ({ '--at': `${ms}ms` }) as CSSProperties;
const SCAN_STYLE = {
  '--scan-start': `${SCAN_START_MS}ms`,
  '--scan-ms': `${SCAN_MS}ms`,
} as CSSProperties;
const DISCARD_STYLE = { '--discard-at': `${DISCARD_AT_MS}ms` } as CSSProperties;

/**
 * La revisión de un conteo contada sobre una foto aérea de ejemplo: una línea barre la imagen y el
 * modelo propone cada animal al pasar (amarillo); luego una persona descarta su error (rojo
 * punteado) y añade los que faltaron (cian). El HUD cuenta al ritmo de las marcas.
 */
export function HeroScan() {
  const [mode, setMode] = useState<Mode>('idle');
  const [run, setRun] = useState(0);
  const [frame, setFrame] = useState<HeroFrame>({ stage: 'scan', count: 0 });
  const play = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMode('still');
      setFrame(FINAL);
      return;
    }
    setMode('play');
    setRun((n) => n + 1);
    setFrame({ stage: 'scan', count: 0 });
  }, []);

  // El HUD cuenta en cada cuadro mientras corre la secuencia. Cada `run` reinicia el reloj, a la
  // vez que el `key` reinicia las animaciones CSS de las marcas.
  useEffect(() => {
    if (mode !== 'play') return;
    const start = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      const next = frameAt(now - start, SCRIPT);
      setFrame((prev) => (prev.stage === next.stage && prev.count === next.count ? prev : next));
      if (next.stage !== 'done') id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [mode, run]);

  return (
    <figure className="hero-scan" data-stage={frame.stage}>
      <div className="hero-scan__frame">
        <div className="hero-scan__stage">
          <Image
            src={heroHerd}
            alt="Foto aérea de ejemplo: un hato de búfalas en un potrero de los Llanos."
            className="hero-scan__photo"
            placeholder="blur"
            preload
            sizes="(max-width: 60rem) calc(100vw - 2rem), 44rem"
            onLoad={play}
          />
          {mode !== 'idle' && (
            <div
              key={run}
              className="hero-scan__overlay"
              data-mode={mode}
              style={SCAN_STYLE}
              aria-hidden="true"
            >
              <span className="hero-scan__sweep" />
              <svg viewBox={`0 0 ${W} ${H}`} className="hero-scan__marks" focusable="false">
                {SCRIPT.proposed.map((box) => {
                  const fp = box === FALSE_POSITIVE;
                  return (
                    <Mark
                      key={`${box.x}-${box.y}`}
                      box={box}
                      variant={fp ? 'discard' : 'model'}
                      style={{ ...at(appearAtMs(box, H)), ...(fp && DISCARD_STYLE) }}
                    />
                  );
                })}
                {SCRIPT.missed.map((box, i) => (
                  <Mark
                    key={`${box.x}-${box.y}`}
                    box={box}
                    variant="human"
                    style={at(addAtMs(i))}
                  />
                ))}
                <Ripple box={FALSE_POSITIVE} variant="discard" style={at(DISCARD_AT_MS)} />
                {SCRIPT.missed.map((box, i) => (
                  <Ripple key={i} box={box} variant="human" style={at(addAtMs(i))} />
                ))}
              </svg>
            </div>
          )}
        </div>
        <span className="hero-scan__tag">Ejemplo</span>
      </div>

      <figcaption className="hero-scan__hud">
        <span className="visually-hidden">
          {`Ejemplo de revisión: el modelo propone ${SCRIPT.proposed.length} animales; una persona descarta 1 y añade ${SCRIPT.missed.length}. Total confirmado: ${TOTAL}.`}
        </span>
        <span className="hero-scan__legend" aria-hidden="true">
          <span className="landing-swatch landing-swatch--model" /> Modelo
          <span className="landing-swatch landing-swatch--human" /> Persona
          <span className="landing-swatch landing-swatch--discard" /> Descartada
        </span>
        <span className="hero-scan__total" aria-hidden="true">
          {frame.stage === 'done' ? (
            <ShieldCheckIcon size={16} className="hero-scan__check" />
          ) : (
            <span className="hero-scan__pulse" />
          )}
          <span className="hero-scan__label">{STAGE_LABEL[frame.stage]}</span>
          <RollingNumber value={frame.count} className="hero-scan__count" />
        </span>
        {mode === 'play' && frame.stage === 'done' && (
          <button type="button" className="hero-scan__replay" onClick={play}>
            <RefreshIcon size={14} />
            <span className="visually-hidden">Ver la revisión otra vez</span>
          </button>
        )}
      </figcaption>
    </figure>
  );
}

function Mark({
  box,
  variant,
  style,
}: {
  box: MarkBox;
  variant: 'model' | 'discard' | 'human';
  style: CSSProperties;
}) {
  const x = box.x - box.w / 2 - PAD;
  const y = box.y - box.h / 2 - PAD;
  return (
    <g className={`hero-mark hero-mark--${variant}`} style={style}>
      <rect
        className="hero-mark__flash"
        x={x}
        y={y}
        width={box.w + 2 * PAD}
        height={box.h + 2 * PAD}
      />
      <rect
        className="hero-mark__box"
        x={x}
        y={y}
        width={box.w + 2 * PAD}
        height={box.h + 2 * PAD}
        rx={6}
      />
      <path className="hero-mark__corners" d={cornersPath(box, PAD)} />
    </g>
  );
}

/** El gesto de la persona: un anillo que se abre donde descarta o añade. */
function Ripple({
  box,
  variant,
  style,
}: {
  box: MarkBox;
  variant: 'discard' | 'human';
  style: CSSProperties;
}) {
  return (
    <circle
      className={`hero-ripple hero-ripple--${variant}`}
      cx={box.x}
      cy={box.y}
      r={Math.max(box.w, box.h)}
      style={style}
    />
  );
}
