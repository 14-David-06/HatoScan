/**
 * ID de conteo con el prefijo atenuado: en una lista todos empiezan igual y lo que se busca con la
 * vista es el número. En pantallas estrechas el prefijo se oculta a la vista (counts.css), pero el
 * texto completo se conserva para copiar y para lectores de pantalla.
 */
export function CountId({ id }: { id: string }) {
  const match = /^(.*-)(\d+)$/.exec(id);
  if (!match) return <span className="counts-id">{id}</span>;
  return (
    <span className="counts-id">
      <span className="counts-id__prefix">{match[1]}</span>
      <span className="counts-id__number">{match[2]}</span>
    </span>
  );
}
