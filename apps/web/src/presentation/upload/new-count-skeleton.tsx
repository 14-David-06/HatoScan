import type { CSSProperties } from 'react';

const width = (value: string): CSSProperties => ({ width: value });

/** Esqueleto de «Nuevo conteo» mientras el servidor consulta los métodos de detección. */
export function NewCountSkeleton() {
  return (
    <main className="page new-count" aria-busy="true">
      <span className="visually-hidden" role="status">
        Cargando el formulario de nuevo conteo…
      </span>
      <div className="page-header new-count__header" aria-hidden="true">
        <div className="page-header__text">
          <span className="skeleton new-count-skeleton__line" style={width('9rem')} />
          <span
            className="skeleton"
            style={{ width: '18rem', maxWidth: '100%', height: '2.5rem' }}
          />
          <span className="skeleton new-count-skeleton__line" style={width('min(42rem, 100%)')} />
          <span className="skeleton new-count-skeleton__line" style={width('min(14rem, 60%)')} />
        </div>
      </div>

      <div className="new-count__layout" aria-hidden="true">
        <div className="new-count__photo">
          <span className="new-count-skeleton__visor" />
        </div>
        <div className="panel new-count__panel">
          <div className="new-count__fields">
            <div className="new-count__row">
              <span className="skeleton new-count-skeleton__control" />
              <span className="skeleton new-count-skeleton__control" />
            </div>
            <span className="skeleton new-count-skeleton__control" />
            <span className="skeleton new-count-skeleton__line" style={width('10rem')} />
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="skeleton new-count-skeleton__option" />
            ))}
          </div>
          <div className="new-count__submit">
            <span className="skeleton new-count-skeleton__button" />
          </div>
        </div>
      </div>
    </main>
  );
}
