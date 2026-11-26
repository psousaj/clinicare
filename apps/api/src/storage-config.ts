type StorageEnv = Record<string, string | undefined>;

export function resolveStorageConfig(env: StorageEnv = process.env) {
  const ministackEndpoint = env.MINISTACK_ENDPOINT?.trim();
  if (ministackEndpoint) {
    if (env.NODE_ENV === 'production') {
      throw new Error('MINISTACK_ENDPOINT não pode ser usado em produção.');
    }
    if (!env.MINISTACK_BUCKET?.trim()) throw new Error('MINISTACK_BUCKET é obrigatório quando MiniStack está configurado.');
    if (!env.MINISTACK_ACCESS_KEY_ID?.trim() || !env.MINISTACK_SECRET_ACCESS_KEY?.trim()) {
      throw new Error('MINISTACK_ACCESS_KEY_ID e MINISTACK_SECRET_ACCESS_KEY são obrigatórias quando MiniStack está configurado.');
    }
    return {
      endpoint: ministackEndpoint,
      bucket: env.MINISTACK_BUCKET.trim(),
      region: 'us-east-1',
      forcePathStyle: true,
      provider: 'ministack' as const,
    };
  }

  if (env.R2_ENDPOINT_URL?.trim()) {
    throw new Error('R2_ENDPOINT_URL foi removida; configure CLOUDFLARE_ACCOUNT_ID e R2_BUCKET.');
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const bucket = env.R2_BUCKET?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
    throw new Error('R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY devem ser configuradas juntas.');
  }
  if (!accountId && !bucket && !accessKeyId && !secretAccessKey && env.NODE_ENV !== 'production') {
    return { endpoint: undefined, bucket: undefined, region: 'auto', forcePathStyle: false, provider: 'r2' as const };
  }
  if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId)) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID deve conter o account ID Cloudflare de 32 caracteres hexadecimais.');
  }
  if (!bucket) throw new Error('R2_BUCKET é obrigatório para configurar o R2.');
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error('R2_BUCKET deve ser um nome de bucket R2 válido.');
  }
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY são obrigatórias para configurar o R2.');
  }

  return {
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    bucket,
    region: 'auto',
    forcePathStyle: false,
    provider: 'r2' as const,
  };
}
