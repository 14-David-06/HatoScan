import { ClaudeVisionMethod } from './claude-vision';
import type { DetectionMethodAdapter } from './method';
import { OpenAiVisionMethod } from './openai-vision';

export interface DetectionMethodKeys {
  readonly anthropicApiKey: string | undefined;
  readonly openaiApiKey: string | undefined;
}

/**
 * Todos los métodos de detección, en el orden en que se ofrecen. Uno sin llave se lista como no
 * disponible. Para añadir un método: implementar `DetectionMethodAdapter` y registrarlo aquí. La
 * imagen llega a resolución completa: no reescalar (los animales miden 10–20 px).
 */
export function createDetectionMethods(keys: DetectionMethodKeys): DetectionMethodAdapter[] {
  const { anthropicApiKey, openaiApiKey } = keys;
  return [
    new ClaudeVisionMethod({
      apiKey: anthropicApiKey,
      name: 'claude-vision',
      model: 'claude-opus-5-5',
      label: 'IA · Claude Opus 5.5 (Anthropic)',
      description:
        'El modelo de visión más capaz de Anthropic revisa la foto por partes y marca cada ' +
        'animal. No necesita entrenamiento; cuesta por foto y tarda unos minutos.',
    }),
    new ClaudeVisionMethod({
      apiKey: anthropicApiKey,
      name: 'claude-vision-sonnet',
      model: 'claude-sonnet-5-5',
      label: 'IA · Claude Sonnet 5.5 (Anthropic)',
      description:
        'Modelo de Anthropic más rápido y económico que Opus, con muy buena visión. Revisa la ' +
        'foto por partes y marca cada animal.',
    }),
    new OpenAiVisionMethod({
      apiKey: openaiApiKey,
      name: 'openai-vision',
      model: 'gpt-6-astra',
      label: 'IA · GPT-6 Astra (OpenAI)',
      description:
        'El modelo insignia de OpenAI revisa la foto por partes y marca cada animal. No necesita ' +
        'entrenamiento; cuesta por foto y tarda unos minutos.',
    }),
    new OpenAiVisionMethod({
      apiKey: openaiApiKey,
      name: 'openai-vision-sol',
      model: 'gpt-6.1-sol',
      label: 'IA · GPT-6.1 Sol (OpenAI)',
      description:
        'Modelo de OpenAI que equilibra precisión y costo. Revisa la foto por partes y marca ' +
        'cada animal.',
    }),
  ];
}

/** Filtra por `DETECTOR_ENABLED_METHODS`; sin lista, se ofrecen todos. */
export function enabledMethods(
  methods: readonly DetectionMethodAdapter[],
  enabled: readonly string[] | undefined,
): DetectionMethodAdapter[] {
  if (!enabled) return [...methods];
  const known = new Set(methods.map((m) => m.name));
  const unknown = enabled.filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown detection methods in DETECTOR_ENABLED_METHODS: ${unknown.join(', ')}`);
  }
  return methods.filter((m) => enabled.includes(m.name));
}
