import { InvalidValueError } from '../errors';

/** Versión del detector que produjo una propuesta, ej. `claude-vision@0.3.0` + hash de parámetros. */
export interface DetectorVersion {
  /** `nombre@MAJOR.MINOR.PATCH` */
  readonly version: string;
  /** SHA-256 hex del JSON canónico de los parámetros usados. */
  readonly paramsHash: string;
}

const VERSION_PATTERN = /^[a-z0-9][a-z0-9-]*@\d+\.\d+\.\d+$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

export function toDetectorVersion(version: string, paramsHash: string): DetectorVersion {
  if (!VERSION_PATTERN.test(version)) {
    throw new InvalidValueError(`Invalid detector version: "${version}"`);
  }
  if (!HASH_PATTERN.test(paramsHash)) {
    throw new InvalidValueError(`Invalid params hash: "${paramsHash}"`);
  }
  return { version, paramsHash };
}
