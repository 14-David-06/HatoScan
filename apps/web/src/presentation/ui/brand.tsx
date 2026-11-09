/**
 * Marca de HatoScan: el visor del dron (las cuatro esquinas del encuadre) con una detección en el
 * centro, el anillo amarillo del modelo alrededor de un animal visto desde arriba. Es lo que el
 * revisor ve sobre la foto. Misma figura que el favicon (`scripts/generate-icons.mjs`); aquí los
 * colores salen de los tokens.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      className="brand__mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="brand__tile" x="0.5" y="0.5" width="31" height="31" rx="7.25" />
      <path
        className="brand__frame"
        d="M6.5 11.5V6.5h5M20.5 6.5h5v5M25.5 20.5v5h-5M11.5 25.5h-5v-5"
        fill="none"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="brand__ring" cx="16" cy="16" r="5.4" fill="none" strokeWidth="2.1" />
      <ellipse
        className="brand__animal"
        cx="16"
        cy="16"
        rx="2.5"
        ry="1.45"
        transform="rotate(-30 16 16)"
      />
    </svg>
  );
}
