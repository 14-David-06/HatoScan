import Link from 'next/link';
import { SPECIES_LABELS, STATUS_LABELS, type CountSummaryView } from '../view-models';

export function CountsScreen({ counts }: { counts: readonly CountSummaryView[] }) {
  const pending = counts.filter((c) => c.status === 'pendiente_revision').length;

  return (
    <main className="page">
      <header className="page__header">
        <div>
          <h1>Conteos</h1>
          <p className="muted">
            El detector propone; una persona confirma. El total revisado es el dato oficial.
          </p>
        </div>
        <Link href="/conteos/nuevo" className="button button--primary">
          Nuevo conteo
        </Link>
      </header>

      {counts.length === 0 ? (
        <section className="empty">
          <h2>Todavía no hay conteos</h2>
          <p className="muted">Sube la primera foto aérea de un potrero para empezar.</p>
        </section>
      ) : (
        <>
          {pending > 0 && (
            <p className="notice">
              {pending === 1 ? '1 conteo espera revisión.' : `${pending} conteos esperan revisión.`}
            </p>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Conteo</th>
                  <th>Potrero</th>
                  <th>Especie</th>
                  <th>Fecha de vuelo</th>
                  <th>Estado</th>
                  <th className="num">Modelo</th>
                  <th className="num">Revisado</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/conteos/${c.id}`}>{c.id}</Link>
                    </td>
                    <td>{c.pastureId}</td>
                    <td>{SPECIES_LABELS[c.species]}</td>
                    <td>{c.flightDate}</td>
                    <td>
                      <span className={`status status--${c.status}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="num">{c.modelTotal ?? '—'}</td>
                    <td className="num">
                      <strong>{c.reviewedTotal ?? '—'}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
