/**
 * Esqueleto del detalle del conteo (loading.tsx): la misma estructura que la página real —migas,
 * título, hechos, visor y panel lateral— para que al llegar los datos nada salte de sitio.
 */
export function CountSkeleton() {
  return (
    <main className="page page--wide count count--fill" aria-busy="true">
      <p className="visually-hidden" role="status">
        Cargando el conteo…
      </p>

      <div className="count-header" aria-hidden="true">
        <span className="skeleton count-skeleton__crumb" />
        <div className="count-header__title">
          <span className="skeleton count-skeleton__title" />
          <span className="skeleton count-skeleton__badge" />
        </div>
        <div className="count-header__facts count-skeleton__facts">
          {FACT_WIDTHS.map((width, index) => (
            <span key={index} className="count-skeleton__fact">
              <span className="skeleton count-skeleton__label" />
              <span className={`skeleton count-skeleton__value count-skeleton__value--${width}`} />
            </span>
          ))}
        </div>
      </div>

      <div className="count-stage" aria-hidden="true">
        <div className="count-photo" />
        <div className="panel count-side">
          <span className="skeleton count-skeleton__heading" />
          <span className="skeleton count-skeleton__line" />
          <span className="skeleton count-skeleton__line count-skeleton__line--short" />
          <span className="skeleton count-skeleton__control" />
          <span className="skeleton count-skeleton__control" />
        </div>
      </div>
    </main>
  );
}

const FACT_WIDTHS = ['md', 'sm', 'md', 'xs', 'xs', 'lg', 'xs'] as const;
