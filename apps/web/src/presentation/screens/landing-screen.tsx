import Link from 'next/link';
import { BrandMark } from '../ui/brand';
import { HeroScan } from '../landing/hero-scan';

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

        <HeroScan />
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
