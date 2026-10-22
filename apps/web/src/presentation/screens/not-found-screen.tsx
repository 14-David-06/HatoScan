import Link from 'next/link';
import { CrosshairIcon, ListIcon } from '../ui/icons';

const COPY = {
  count: {
    title: 'No encontramos ese conteo',
    text: 'El enlace no lleva a ningún conteo: puede que el ID esté mal escrito o que ya no exista. Búscalo en la lista.',
  },
  page: {
    title: 'No encontramos esta página',
    text: 'La dirección no lleva a ninguna parte de HatoScan. Revisa el enlace o vuelve a la lista de conteos.',
  },
} as const;

/** 404. `count`: el ID no corresponde a ningún conteo; `page`: la ruta no existe. */
export function NotFoundScreen({ variant = 'page' }: { variant?: keyof typeof COPY }) {
  const { title, text } = COPY[variant];

  return (
    <main className="page page--narrow">
      <section className="fallback" aria-labelledby="fallback-title">
        {/* El visor apunta y no encuentra nada: la retícula vacía. */}
        <span className="fallback__mark" aria-hidden="true">
          <CrosshairIcon size={28} />
        </span>
        <h1 id="fallback-title" className="fallback__title">
          {title}
        </h1>
        <p className="fallback__text">{text}</p>
        <div className="fallback__actions">
          <Link href="/conteos" className="button button--primary">
            <ListIcon size={16} />
            Ir a la lista de conteos
          </Link>
        </div>
      </section>
    </main>
  );
}
