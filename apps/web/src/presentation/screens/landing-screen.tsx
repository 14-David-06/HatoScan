import Link from 'next/link';
import { BrandMark } from '../ui/brand';
import { ShieldCheckIcon } from '../ui/icons';

/** Animales del potrero dibujado: posiciones fijas (no aleatorias) para que el SVG sea estable. */
const HERD: readonly (readonly [number, number, number])[] = [
  [212, 148, -20],
  [236, 162, 15],
  [224, 186, 40],
  [258, 141, -5],
  [270, 178, 25],
  [248, 205, -35],
  [292, 160, 10],
  [301, 196, -15],
  [282, 222, 30],
  [318, 178, 5],
  [330, 214, -25],
  [312, 240, 20],
  [346, 190, 35],
  [358, 232, -10],
  [340, 258, 15],
  [372, 206, -30],
  [388, 246, 10],
  [196, 210, 20],
  [182, 176, -40],
  [404, 218, 25],
  [520, 120, 10],
  [544, 136, -20],
  [532, 160, 30],
  [560, 112, -5],
  [568, 150, 15],
  [610, 300, -15],
  [636, 316, 20],
  [622, 338, -30],
  [652, 292, 5],
  [660, 330, 25],
  [140, 330, 10],
  [168, 348, -25],
  [452, 360, 15],
];
/** Un arbusto que el modelo confunde con un animal: la persona lo descarta. */
const FALSE_POSITIVE: readonly [number, number] = [470, 250];
/** Un animal a la sombra que el modelo no ve: la persona lo añade. */
const MISSED: readonly [number, number] = [590, 128];

const STEPS = [
  {
    title: 'Sube la foto del dron',
    text: 'La original, sin recortar: los animales miden 10–20 px y el detector necesita cada píxel.',
  },
  {
    title: 'El detector propone',
    text: 'Marca cada animal que encuentra. Es una propuesta, nunca el dato oficial.',
  },
  {
    title: 'Una persona confirma',
    text: 'Descarta lo que no es, añade lo que faltó y confirma. Ese total es el inventario.',
  },
] as const;

export function LandingScreen({ signedIn }: { signedIn: boolean }) {
  const total = HERD.length + 1;
  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="landing-hero__text">
          <h1 className="landing-hero__title">Cuenta el hato desde el aire</h1>
          <p className="landing-hero__lead">
            HatoScan cuenta búfalas y bovinos en las fotos de dron de cada potrero. El detector
            propone; una persona confirma. Cada conteo queda auditable: quién lo revisó, con qué
            detector y sobre qué imagen.
          </p>
          <div className="landing-hero__actions">
            <Link
              href={signedIn ? '/conteos' : '/ingresar'}
              className="button button--primary button--lg"
            >
              {signedIn ? 'Ir a los conteos' : 'Ingresar'}
            </Link>
            <p className="landing-hero__note">Acceso solo para el equipo de Sirius Regenerative.</p>
          </div>
        </div>

        <figure className="landing-visor" aria-label={`Ejemplo de revisión: ${total} animales`}>
          <svg viewBox="0 0 760 440" className="landing-visor__svg" aria-hidden="true">
            <defs>
              <pattern id="landing-grass" width="14" height="14" patternUnits="userSpaceOnUse">
                <path d="M0 14L14 0" className="landing-visor__grass" />
              </pattern>
            </defs>
            <rect width="760" height="440" className="landing-visor__field" />
            <rect width="760" height="440" fill="url(#landing-grass)" />
            <path
              d="M0 70C140 40 260 96 420 64S690 20 760 44M0 400C180 360 300 420 470 386S680 350 760 372"
              className="landing-visor__contour"
            />
            <path d="M-10 290C120 270 230 300 330 288" className="landing-visor__track" />
            <circle
              cx={FALSE_POSITIVE[0]}
              cy={FALSE_POSITIVE[1]}
              r="9"
              className="landing-visor__bush"
            />

            {HERD.map(([x, y, angle], i) => (
              <g key={i} transform={`translate(${x} ${y}) rotate(${angle})`}>
                <ellipse rx="8" ry="4.6" className="landing-visor__animal" />
                <circle
                  r="13"
                  className="landing-visor__mark landing-visor__mark--model"
                  style={{ animationDelay: `${600 + i * 55}ms` }}
                />
              </g>
            ))}
            <g transform={`translate(${MISSED[0]} ${MISSED[1]}) rotate(-10)`}>
              <ellipse rx="8" ry="4.6" className="landing-visor__animal" />
              <circle r="13" className="landing-visor__mark landing-visor__mark--human" />
            </g>
            <circle
              cx={FALSE_POSITIVE[0]}
              cy={FALSE_POSITIVE[1]}
              r="13"
              className="landing-visor__mark landing-visor__mark--discard"
            />
          </svg>
          <figcaption className="landing-visor__hud">
            <span className="landing-visor__legend">
              <span className="landing-swatch landing-swatch--model" /> Modelo
              <span className="landing-swatch landing-swatch--human" /> Persona
              <span className="landing-swatch landing-swatch--discard" /> Descartada
            </span>
            <span className="landing-visor__total">
              <ShieldCheckIcon size={16} /> Total confirmado <strong>{total}</strong>
            </span>
          </figcaption>
        </figure>
      </section>

      <section className="landing-steps" aria-labelledby="landing-steps-title">
        <h2 id="landing-steps-title" className="landing-steps__title">
          Así se hace un conteo
        </h2>
        <ol className="landing-steps__list">
          {STEPS.map((step, i) => (
            <li key={step.title} className="landing-step">
              <span className="landing-step__number" aria-hidden="true">
                {i + 1}
              </span>
              <h3 className="landing-step__title">{step.title}</h3>
              <p className="landing-step__text">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="landing-footer">
        <BrandMark size={20} />
        <span>HatoScan es parte de Sirius Verse.</span>
      </footer>
    </main>
  );
}
