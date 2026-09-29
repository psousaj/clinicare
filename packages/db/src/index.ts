import mongoose from 'mongoose';

let connection: Promise<typeof mongoose> | null = null;
export function connectDatabase(uri = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required.');
  connection ??= mongoose.connect(uri);
  return connection;
}
export async function disconnectDatabase() {
  connection = null;
  await mongoose.disconnect();
}
export * from './schema';
