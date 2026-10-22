import { formatInteger } from '../format';

/** Un carácter de una cifra que rueda: los dígitos se identifican por su posición desde la derecha. */
export interface DigitSlot {
  readonly key: string;
  readonly char: string;
  /** Valor del dígito; ausente en los separadores de miles. */
  readonly digit?: number;
}

/**
 * Descompone un entero en las columnas de la cifra animada. La clave es la posición desde la
 * derecha (unidades, decenas…), así al pasar de 99 a 100 las columnas existentes conservan su
 * identidad y solo ruedan, y la nueva aparece a la izquierda.
 */
export function digitSlots(value: number): readonly DigitSlot[] {
  const text = formatInteger(value);
  const slots: DigitSlot[] = [];
  let place = 0;
  let separators = 0;
  for (let i = text.length - 1; i >= 0; i -= 1) {
    const char = text.charAt(i);
    if (char >= '0' && char <= '9') {
      slots.push({ key: `d${place}`, char, digit: Number(char) });
      place += 1;
    } else {
      slots.push({ key: `s${separators}`, char });
      separators += 1;
    }
  }
  return slots.reverse();
}

/** Espacio fino de no separación, el mismo que separa los miles en `formatInteger`. */
const NARROW_NBSP = String.fromCharCode(0x202f);

/** Zoom relativo a la resolución original: `62 %` (100 % = 1 píxel de imagen por píxel de pantalla). */
export function formatZoom(scale: number): string {
  return `${formatInteger(Math.round(scale * 100))}${NARROW_NBSP}%`;
}

/** `1 animal`, `120 animales`. */
export function formatAnimals(count: number): string {
  return `${formatInteger(count)} ${count === 1 ? 'animal' : 'animales'}`;
}
