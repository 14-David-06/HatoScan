/** Colombia está en UTC−5 todo el año (sin horario de verano). */
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

/**
 * Instante ISO (UTC) → día de calendario en Bogotá, `AAAA-MM-DD`. Una revisión hecha a las 21:00 en
 * la finca no debe figurar con la fecha del día siguiente. Determinista: no depende de la zona del
 * servidor ni del navegador.
 */
export function bogotaDay(instant: string): string {
  const time = Date.parse(instant);
  if (Number.isNaN(time)) return instant;
  return new Date(time + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}
