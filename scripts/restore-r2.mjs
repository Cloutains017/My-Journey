import { createReadStream } from 'node:fs';
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

export async function restoreR2Objects(client, bucket, objects) {
  let uploaded = 0;
  let present = 0;
  for (const object of objects) {
    let existing;
    try {
      existing = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: object.key }));
    } catch (error) {
      if (error.$metadata?.httpStatusCode !== 404 && error.name !== 'NotFound' && error.name !== 'NoSuchKey') throw error;
    }
    if (existing) {
      if (existing.ContentLength !== object.bytes || (object.etag && existing.ETag !== object.etag)) {
        throw new Error(`R2 object differs from backup: ${object.key}`);
      }
      present++;
      continue;
    }
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket, Key: object.key, Body: createReadStream(object.path),
        ContentLength: object.bytes, ContentType: object.contentType || 'application/octet-stream',
        IfNoneMatch: '*',
      }));
      uploaded++;
    } catch (error) {
      if (error.$metadata?.httpStatusCode === 412) throw new Error(`R2 object appeared during restore: ${object.key}`);
      throw error;
    }
  }
  return { uploaded, present };
}
