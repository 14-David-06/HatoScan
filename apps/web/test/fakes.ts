import {
  Count,
  toCountId,
  toDetectorVersion,
  type Clock,
  type CountId,
  type CountIdGenerator,
  type CountRepository,
  type DetectInput,
  type DetectionMethodCatalog,
  type Detection,
  type DetectionOutput,
  type DetectionResultStore,
  type Detector,
  type ObjectInfo,
  type ObjectStorage,
  type ReviewRecord,
  type UploadTarget,
} from '@/domain/index';

export const COUNT_ID = toCountId('SIRIUS-CONTEO-0001');
export const DETECTOR = toDetectorVersion('claude-vision@0.3.0', 'a'.repeat(64));
export const IMAGE = { width: 1000, height: 800 } as const;

export function newCount(): Count {
  return Count.create({
    id: COUNT_ID,
    farm: 'Guaicaramo',
    pastureId: 'POTRERO-01',
    species: 'bufala',
    flightDate: new Date('2026-09-20T07:00:00Z'),
    uploadedAt: new Date('2026-09-20T12:00:00Z'),
    flight: { altitudeM: 80 },
    originalImageKey: 'counts/SIRIUS-CONTEO-0001/original.jpg',
  });
}

/** Un override `undefined` elimina la propiedad (ej. `{ w: undefined }` para un punto). */
type DetectionOverrides = { [K in keyof Detection]?: Detection[K] | undefined };

export function modelDetection(id: string, overrides: DetectionOverrides = {}): Detection {
  const merged = {
    id,
    x: 10,
    y: 10,
    tipo: 'caja',
    w: 15,
    h: 12,
    score: 0.9,
    origen: 'modelo',
    estado: 'activa',
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined),
  ) as unknown as Detection;
}

export class InMemoryCounts implements CountRepository {
  readonly saved: Count[] = [];
  private readonly byId = new Map<CountId, Count>();

  constructor(...counts: Count[]) {
    for (const c of counts) this.byId.set(c.id, c);
  }

  findById(id: CountId): Promise<Count | undefined> {
    return Promise.resolve(this.byId.get(id));
  }

  list(): Promise<readonly Count[]> {
    const all = [...this.byId.values()];
    return Promise.resolve(all.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()));
  }

  save(count: Count): Promise<void> {
    this.saved.push(count);
    this.byId.set(count.id, count);
    return Promise.resolve();
  }
}

export class FakeDetector implements Detector {
  readonly calls: DetectInput[] = [];

  constructor(private readonly respond: (input: DetectInput) => Promise<DetectionOutput>) {}

  detect(input: DetectInput): Promise<DetectionOutput> {
    this.calls.push(input);
    return this.respond(input);
  }

  methods(): Promise<DetectionMethodCatalog> {
    return Promise.resolve({
      defaultMethod: 'claude-vision',
      methods: [
        {
          name: 'claude-vision',
          version: '0.3.0',
          label: 'IA · Claude',
          description: 'Prueba',
          available: true,
        },
      ],
    });
  }
}

export const detectorReturning = (detections: Detection[]): FakeDetector =>
  new FakeDetector(() =>
    Promise.resolve({ detector: DETECTOR, params: {}, image: IMAGE, detections }),
  );

export class FakeStorage implements ObjectStorage {
  readonly puts: { key: string; contentType: string; size: number }[] = [];
  readonly copies: { from: string; to: string }[] = [];
  readonly deletes: string[] = [];
  /** Objetos que existen sin haber pasado por `put` (ej. subidos por el navegador). */
  readonly objects = new Map<string, ObjectInfo>();

  put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    this.puts.push({ key, contentType, size: body.byteLength });
    this.objects.set(key, { size: body.byteLength, contentType });
    return Promise.resolve();
  }
  /** Bytes deterministas por clave: cada objeto "contiene" su propia clave. */
  static bytesOf(key: string): Uint8Array {
    return new TextEncoder().encode(key);
  }
  get(key: string): Promise<Uint8Array> {
    return Promise.resolve(FakeStorage.bytesOf(key));
  }
  getReadUrl(key: string): Promise<string> {
    return Promise.resolve(`https://storage.test/${key}?signed`);
  }
  getUploadUrl(key: string, contentType: string): Promise<UploadTarget> {
    return Promise.resolve({
      url: `https://storage.test/${key}?upload`,
      method: 'PUT',
      headers: { 'content-type': contentType },
    });
  }
  stat(key: string): Promise<ObjectInfo | undefined> {
    return Promise.resolve(this.objects.get(key));
  }
  copy(from: string, to: string): Promise<void> {
    const object = this.objects.get(from);
    if (!object) return Promise.reject(new Error(`Object not found: ${from}`));
    this.copies.push({ from, to });
    this.objects.set(to, object);
    return Promise.resolve();
  }
  delete(key: string): Promise<void> {
    this.deletes.push(key);
    this.objects.delete(key);
    return Promise.resolve();
  }
}

export class InMemoryResults implements DetectionResultStore {
  readonly models = new Map<string, DetectionOutput>();
  readonly reviews = new Map<string, ReviewRecord>();

  saveModelResult(countId: CountId, output: DetectionOutput): Promise<string> {
    const key = `counts/${countId}/model.json`;
    this.models.set(key, output);
    return Promise.resolve(key);
  }

  loadModelResult(key: string): Promise<DetectionOutput> {
    const output = this.models.get(key);
    return output ? Promise.resolve(output) : Promise.reject(new Error(`missing ${key}`));
  }

  saveReview(review: ReviewRecord): Promise<string> {
    const key = `counts/${review.countId}/review.json`;
    this.reviews.set(key, review);
    return Promise.resolve(key);
  }

  loadReview(key: string): Promise<ReviewRecord> {
    const review = this.reviews.get(key);
    return review ? Promise.resolve(review) : Promise.reject(new Error(`missing ${key}`));
  }
}

export class SequentialIds implements CountIdGenerator {
  constructor(private last = 0) {}

  next(): Promise<CountId> {
    this.last += 1;
    return Promise.resolve(toCountId(`SIRIUS-CONTEO-${String(this.last).padStart(4, '0')}`));
  }
}

export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });
