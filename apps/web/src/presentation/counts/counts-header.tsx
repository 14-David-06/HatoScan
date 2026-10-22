/** Cabecera de la lista. La comparten la página y su esqueleto: el texto es fijo y no salta al cargar. */
export function CountsHeader() {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1>Conteos</h1>
        <p>El detector propone; una persona confirma; el total revisado es el dato oficial.</p>
      </div>
    </header>
  );
}
