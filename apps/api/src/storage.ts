import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
export const bucket = process.env.R2_BUCKET;
// S3_ENDPOINT aponta para um emulador S3 local (ministack) em dev; sem ele usa o R2.
const s3Endpoint = process.env.S3_ENDPOINT;
const endpoint = s3Endpoint ?? (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
export const storage = endpoint && accessKeyId && secretAccessKey && bucket ? new S3Client({ region: s3Endpoint ? 'us-east-1' : 'auto', endpoint, forcePathStyle: !!s3Endpoint, credentials: { accessKeyId, secretAccessKey } }) : null;
export const uploadUrl = async (key: string, contentType: string) => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  return getSignedUrl(storage, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 300 });
};
export const deleteObject = async (key: string) => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  await storage.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};
export const uploadUrlForDocument = async (key: string) => {
  if (!storage || !bucket) throw new Error('R2 is not configured.');
  return getSignedUrl(storage, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), { expiresIn: 300 });
};
