import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { resolveStorageConfig } from './storage-config';

const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const config = resolveStorageConfig();
const configuredAccessKeyId = config.provider === 'ministack' ? process.env.MINISTACK_ACCESS_KEY_ID : accessKeyId;
const configuredSecretAccessKey = config.provider === 'ministack' ? process.env.MINISTACK_SECRET_ACCESS_KEY : secretAccessKey;
export const bucket = config.bucket;
export const storage = config.endpoint && configuredAccessKeyId && configuredSecretAccessKey && bucket ? new S3Client({ region: config.region, endpoint: config.endpoint, forcePathStyle: config.forcePathStyle, credentials: { accessKeyId: configuredAccessKeyId, secretAccessKey: configuredSecretAccessKey } }) : null;
export const uploadUrl = async (key: string, contentType: string) => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  return getSignedUrl(storage, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 300 });
};
export const downloadUrl = async (key: string) => {
  if (!storage || !bucket) return null;
  return getSignedUrl(storage, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
};
export const uploadUrlForPdf = async (key: string) => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  return getSignedUrl(storage, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'application/pdf' }), { expiresIn: 300 });
};
export const headObject = async (key: string) => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  return storage.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
};

/** Verifies the object uploaded through a presigned URL before it becomes durable catalog data. */
export const verifyPdfObject = async (key: string, expectedHash: string, expectedSize: number) => {
  const metadata = await headObject(key);
  if (metadata.ContentType !== 'application/pdf' || metadata.ContentLength !== expectedSize) return false;
  // HEAD verifies the store's metadata, while reading the bytes verifies the
  // declared digest and prevents a non-PDF object from becoming a document.
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  const response = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) return false;
  const bytes = await response.Body.transformToByteArray();
  return bytes.byteLength === expectedSize
    && new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
    && createHash('sha256').update(bytes).digest('hex') === expectedHash.toLowerCase();
};

/** Copies an immutable source object to a new opaque key and verifies the copy. */
export const copyVerifiedPdfObject = async (sourceKey: string, destinationKey: string, expectedHash: string, expectedSize: number) => {
  return copyVerifiedObject(sourceKey, destinationKey, expectedHash, expectedSize, 'application/pdf');
};

export const deleteObject = async (key: string) => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};

export const downloadObjectBytes = async (key: string) => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  const response = await storage.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error('Objeto não encontrado.');
  return response.Body.transformToByteArray();
};

export const uploadObjectBytes = async (key: string, bytes: Uint8Array, contentType = 'application/pdf') => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  await storage.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType }));
};
export const verifyObjectBytes = async (key: string, expectedHash: string, expectedSize: number) => {
  const bytes = await downloadObjectBytes(key);
  if (bytes.byteLength !== expectedSize || createHash('sha256').update(bytes).digest('hex') !== expectedHash.toLowerCase()) throw new Error('O objeto não corresponde aos metadados persistidos.');
  return bytes;
};

export const uploadUrlForDocument = async (key: string, contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  return getSignedUrl(storage, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 300 });
};
export const uploadObjectBytesForDocument = async (key: string, bytes: Uint8Array) => uploadObjectBytes(key, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
export const copyVerifiedObject = async (sourceKey: string, destinationKey: string, expectedHash: string, expectedSize: number, contentType: string) => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  await storage.send(new CopyObjectCommand({ Bucket: bucket, Key: destinationKey, CopySource: `${bucket}/${sourceKey}`, ContentType: contentType, MetadataDirective: 'REPLACE' }));
  try {
    if (!await verifyObject(destinationKey, expectedHash, expectedSize, contentType)) throw new Error('Copied object does not match the verified source metadata.');
  } catch (error) {
    await deleteObject(destinationKey).catch(() => undefined);
    throw error;
  }
};
export const verifyObject = async (key: string, expectedHash: string, expectedSize: number, contentType: string) => {
  const metadata = await headObject(key);
  if (metadata.ContentType !== contentType || metadata.ContentLength !== expectedSize) return false;
  const bytes = await downloadObjectBytes(key);
  return bytes.byteLength === expectedSize && createHash('sha256').update(bytes).digest('hex') === expectedHash.toLowerCase();
};
