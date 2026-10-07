type StorageEnv = Record<string, string | undefined>;

export function resolveStorageConfig(env: StorageEnv = process.env) {
  const ministackEndpoint = env.MINISTACK_ENDPOINT?.trim();
  if (ministackEndpoint) {
    return {
      endpoint: ministackEndpoint,
      bucket: env.MINISTACK_BUCKET?.trim() || undefined,
      region: 'us-east-1',
      forcePathStyle: true,
      provider: 'ministack' as const,
    };
  }

  const bucketFromEnv = env.R2_BUCKET?.trim() || undefined;
  const configuredUrl = env.R2_ENDPOINT_URL?.trim();
  let endpoint: string | undefined;
  let bucketFromUrl: string | undefined;
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    if (url.protocol !== 'https:' || url.search || url.hash) throw new Error('R2_ENDPOINT_URL deve ser uma URL HTTPS sem query ou fragmento.');
    const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (segments.length > 1) throw new Error('R2_ENDPOINT_URL deve conter no máximo o caminho de um bucket.');
    endpoint = url.origin;
    bucketFromUrl = segments[0];
    if (bucketFromEnv && bucketFromUrl && bucketFromEnv !== bucketFromUrl) throw new Error('R2_BUCKET deve corresponder ao bucket indicado em R2_ENDPOINT_URL.');
  } else if (env.CLOUDFLARE_ACCOUNT_ID?.trim()) {
    endpoint = `https://${env.CLOUDFLARE_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`;
  }

  return { endpoint, bucket: bucketFromEnv ?? bucketFromUrl, region: 'auto', forcePathStyle: false, provider: 'r2' as const };
}
