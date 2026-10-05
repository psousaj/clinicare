import { createHash } from 'node:crypto';

export type RawFingerprint = {
  visitorId?: string;
  version?: string;
  attributes?: Record<string, unknown>;
  unavailableAttributes?: string[];
  [key: string]: unknown;
};

export type NormalizedEvidence = {
  collectorVersion: string;
  normalizationVersion: string;
  attributes: Record<string, unknown>;
  unavailableAttributes: string[];
  normalizedRepresentation: Record<string, unknown>;
  digest: string;
};

const DEFAULT_NORMALIZATION_VERSION = 'v1';

export function normalizeEvidence(raw: unknown): NormalizedEvidence {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    const emptyRepr = { attributes: {}, unavailable: [] };
    const digest = createHash('sha256').update(JSON.stringify(emptyRepr)).digest('hex');
    return {
      collectorVersion: 'fingerprintjs-oss-5',
      normalizationVersion: DEFAULT_NORMALIZATION_VERSION,
      attributes: {},
      unavailableAttributes: [],
      normalizedRepresentation: emptyRepr,
      digest,
    };
  }

  const input = raw as RawFingerprint;
  const collectorVersion = typeof input.version === 'string' ? input.version : 'fingerprintjs-oss-5';
  const normalizationVersion = DEFAULT_NORMALIZATION_VERSION;
  
  const rawAttributes = input.attributes && typeof input.attributes === 'object' && !Array.isArray(input.attributes)
    ? input.attributes
    : {};

  const sortedKeys = Object.keys(rawAttributes).sort();
  const attributes: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    attributes[k] = rawAttributes[k];
  }

  const unavailableAttributes = Array.isArray(input.unavailableAttributes)
    ? Array.from(new Set(input.unavailableAttributes.filter((x): x is string => typeof x === 'string'))).sort()
    : [];

  const normalizedRepresentation = {
    visitorId: typeof input.visitorId === 'string' ? input.visitorId : undefined,
    attributes,
    unavailable: unavailableAttributes,
  };

  const serialized = JSON.stringify(normalizedRepresentation);
  const digest = createHash('sha256').update(serialized).digest('hex');

  return {
    collectorVersion,
    normalizationVersion,
    attributes,
    unavailableAttributes,
    normalizedRepresentation,
    digest,
  };
}
