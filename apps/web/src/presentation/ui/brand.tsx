/**
 * Marca de HatoScan: la retícula del visor con una detección en el centro (el círculo amarillo de
 * las propuestas del modelo). Es la misma figura que el revisor ve sobre la foto.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="brand__mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="1.25"
        y="1.25"
        width="29.5"
        height="29.5"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.28"
      />
      <path
        d="M16 4.5v5M16 22.5v5M4.5 16h5M22.5 16h5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle className="brand__target" cx="16" cy="16" r="4.75" strokeWidth="1.75" />
    </svg>
  );
}
