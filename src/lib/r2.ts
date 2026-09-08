import "server-only";

import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage, shared with the FLVS storefront.
 *
 * Same Cloudflare account, same bucket, same public hostname — bran's objects
 * are told apart by their key, not by their address. `R2_PREFIX` is applied by
 * `keyFor` below and nothing in the app builds a key any other way, which is
 * what makes "delete everything bran wrote" a listing on one prefix rather
 * than an audit.
 *
 * Credentials stay on the server. The browser never holds a key; it gets a
 * short-lived presigned URL and PUTs straight to R2, so file bytes never pass
 * through Vercel.
 */
const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;

/** Public base for reads, e.g. https://media.flaves.link. */
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? null;

/**
 * Everything bran writes lives under here. Defaulted rather than required: an
 * empty prefix would silently scatter bran's objects through the storefront's
 * media, and that is not a mistake worth allowing by omission.
 */
const PREFIX = normalisePrefix(process.env.R2_PREFIX ?? "bran/");

const credentialed = Boolean(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY);

export const r2Configured = Boolean(credentialed && BUCKET && R2_PUBLIC_URL);

let cached: S3Client | null | undefined;

function r2(): S3Client | null {
  if (cached !== undefined) return cached;
  cached = credentialed
    ? new S3Client({
        // R2 ignores region, but the SDK requires one.
        region: "auto",
        endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: ACCESS_KEY_ID!,
          secretAccessKey: SECRET_ACCESS_KEY!,
        },
      })
    : null;
  return cached;
}

/**
 * The only way to name an object. Takes a path relative to bran — say
 * `workspaces/abc/logo.png` — and returns the full bucket key.
 */
export function keyFor(path: string): string {
  return PREFIX + path.replace(/^\/+/, "");
}

/** Where an object written under `path` will be readable. */
export function publicUrlFor(path: string): string | null {
  if (!R2_PUBLIC_URL) return null;
  return `${R2_PUBLIC_URL.replace(/\/+$/, "")}/${keyFor(path)}`;
}

/** Presigned PUT for one object, plus the URL it will be readable at. */
export async function presignUpload(
  path: string,
  contentType: string,
  expiresIn = 60,
): Promise<{ uploadUrl: string; publicUrl: string } | null> {
  const client = r2();
  const publicUrl = publicUrlFor(path);
  if (!client || !publicUrl) return null;

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: BUCKET!,
      Key: keyFor(path),
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    {
      expiresIn,
      // Putting content-type in the *signed* headers is what binds it. Setting
      // ContentType on the command alone does not — the signature ignores it,
      // and the uploader can then send whatever type it likes.
      signableHeaders: new Set(["content-type"]),
    },
  );

  return { uploadUrl, publicUrl };
}

export async function deleteObject(path: string): Promise<void> {
  const client = r2();
  if (!client) return;
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET!, Key: keyFor(path) }));
}

/** `bran` and `/bran/` both mean `bran/`. An empty prefix is not allowed. */
function normalisePrefix(value: string): string {
  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return trimmed ? `${trimmed}/` : "bran/";
}
