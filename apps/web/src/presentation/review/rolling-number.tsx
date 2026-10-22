import type { CSSProperties } from 'react';
import { digitSlots } from './review-format';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * Cifra cuyos dígitos ruedan en vertical al cambiar: cada dígito es una columna 0–9 que se
 * traslada (solo `transform`). Es decorativa para los lectores de pantalla; quien la usa anuncia
 * el valor aparte con una región `aria-live`.
 */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className ? `review-roll ${className}` : 'review-roll'} aria-hidden="true">
      {digitSlots(value).map((slot) =>
        slot.digit === undefined ? (
          <span key={slot.key} className="review-roll__sep" />
        ) : (
          <span key={slot.key} className="review-roll__col">
            <span
              className="review-roll__strip"
              style={{ '--roll-digit': slot.digit } as CSSProperties}
            >
              {DIGITS.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        ),
      )}
    </span>
  );
}
