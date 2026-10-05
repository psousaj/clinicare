import FingerprintJS from '@fingerprintjs/fingerprintjs';

export type CollectedFingerprint = {
  version: string;
  visitorId: string;
  attributes: Record<string, unknown>;
  unavailableAttributes: string[];
};

export async function collectFingerprint(): Promise<CollectedFingerprint> {
  try {
    const agent = await FingerprintJS.load();
    const result = await agent.get();
    
    const attributes: Record<string, unknown> = {};
    const unavailableAttributes: string[] = [];

    if (result.components) {
      for (const [key, comp] of Object.entries(result.components)) {
        if (comp && typeof comp === 'object') {
          if ('value' in comp && comp.value !== undefined) {
            attributes[key] = comp.value;
          } else if ('error' in comp) {
            unavailableAttributes.push(key);
          }
        }
      }
    }

    return {
      version: 'fingerprintjs-oss-5',
      visitorId: result.visitorId,
      attributes,
      unavailableAttributes,
    };
  } catch {
    return {
      version: 'fingerprintjs-oss-5',
      visitorId: 'unavailable',
      attributes: {},
      unavailableAttributes: ['all'],
    };
  }
}
