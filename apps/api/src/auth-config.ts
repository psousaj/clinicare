export function getTrustedOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const baseUrl = env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  const configuredOrigins = (env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set([new URL(baseUrl).origin, ...configuredOrigins])];
}
