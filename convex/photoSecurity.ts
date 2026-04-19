import { Id } from "./_generated/dataModel";

const ENCRYPTION_MAGIC = "FPENC1";
const ENCRYPTION_VERSION = 1;
const MAINTENANCE_KEY = "photoUploadsMaintenance";
const AES_GCM_IV_LENGTH = 12;
const PHOTO_URL_TOKEN_TTL_MS = 1000 * 60 * 15;

type PhotoWithStorage = {
  _id: Id<"photos">;
  storageId?: Id<"_storage">;
  thumbnailStorageId?: Id<"_storage">;
  mediumStorageId?: Id<"_storage">;
  originalStorageId?: Id<"_storage">;
  isEncrypted?: boolean;
  encryptionVersion?: number;
  thumbnailContentType?: string;
  mediumContentType?: string;
  originalContentType?: string;
};

export type PhotoVariant = "thumbnail" | "medium" | "original";

type PhotoUrlTokenPayload = {
  photoId: string;
  variant: PhotoVariant;
  exp: number;
};

function decodeBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function toBase64Url(bytes: Uint8Array): string {
  return encodeBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  return decodeBase64(value);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const { buffer, byteOffset, byteLength } = bytes;
  if (buffer instanceof ArrayBuffer) {
    if (byteOffset === 0 && byteLength === buffer.byteLength) {
      return buffer;
    }
    return buffer.slice(byteOffset, byteOffset + byteLength);
  }
  const copy = new Uint8Array(byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function getMasterKey(): Promise<CryptoKey> {
  const base64Key = process.env.PHOTO_ENCRYPTION_KEY;
  if (!base64Key) {
    throw new Error("PHOTO_ENCRYPTION_KEY is not configured");
  }

  const keyBytes = decodeBase64(base64Key);
  if (keyBytes.length !== 32) {
    throw new Error("PHOTO_ENCRYPTION_KEY must be a 32-byte base64 value");
  }

  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

async function getPhotoTokenKey(): Promise<CryptoKey> {
  const base64Key = process.env.PHOTO_ENCRYPTION_KEY;
  if (!base64Key) {
    throw new Error("PHOTO_ENCRYPTION_KEY is not configured");
  }

  const keyBytes = decodeBase64(base64Key);
  if (keyBytes.length !== 32) {
    throw new Error("PHOTO_ENCRYPTION_KEY must be a 32-byte base64 value");
  }

  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(keyBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function parseEncryptedPayload(bytes: Uint8Array) {
  const magicBytes = new TextEncoder().encode(ENCRYPTION_MAGIC);
  if (bytes.length < magicBytes.length + 1 + AES_GCM_IV_LENGTH) {
    throw new Error("Encrypted payload is too short");
  }

  for (let i = 0; i < magicBytes.length; i += 1) {
    if (bytes[i] !== magicBytes[i]) {
      throw new Error("Invalid encrypted payload magic header");
    }
  }

  const version = bytes[magicBytes.length];
  if (version !== ENCRYPTION_VERSION) {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  const ivStart = magicBytes.length + 1;
  const ivEnd = ivStart + AES_GCM_IV_LENGTH;
  return {
    version,
    iv: bytes.slice(ivStart, ivEnd),
    ciphertext: bytes.slice(ivEnd),
  };
}

export async function encryptBlob(blob: Blob): Promise<Blob> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const plaintext = new Uint8Array(await blob.arrayBuffer());
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  const ciphertext = new Uint8Array(encryptedBuffer);
  const magicBytes = new TextEncoder().encode(ENCRYPTION_MAGIC);
  const versionByte = new Uint8Array([ENCRYPTION_VERSION]);
  return new Blob([magicBytes, versionByte, iv, ciphertext], {
    type: "application/octet-stream",
  });
}

export async function decryptBlob(
  blob: Blob,
  outputContentType: string,
): Promise<Blob> {
  const encryptedBytes = new Uint8Array(await blob.arrayBuffer());
  const { iv, ciphertext } = parseEncryptedPayload(encryptedBytes);
  const key = await getMasterKey();
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new Blob([decryptedBuffer], {
    type: outputContentType || "application/octet-stream",
  });
}

export function getPhotoVariantStorageId(
  photo: PhotoWithStorage,
  variant: PhotoVariant,
): Id<"_storage"> | null {
  if (
    photo.thumbnailStorageId &&
    photo.mediumStorageId &&
    photo.originalStorageId
  ) {
    if (variant === "thumbnail") return photo.thumbnailStorageId;
    if (variant === "medium") return photo.mediumStorageId;
    return photo.originalStorageId;
  }

  if (photo.storageId) {
    return photo.storageId;
  }

  return null;
}

export function getPhotoVariantContentType(
  photo: PhotoWithStorage,
  variant: PhotoVariant,
): string {
  if (
    photo.thumbnailStorageId &&
    photo.mediumStorageId &&
    photo.originalStorageId
  ) {
    if (variant === "thumbnail") {
      return photo.thumbnailContentType || "image/jpeg";
    }
    if (variant === "medium") {
      return photo.mediumContentType || "image/jpeg";
    }
    return photo.originalContentType || "application/octet-stream";
  }

  return photo.originalContentType || "application/octet-stream";
}

export async function buildPhotoProxyUrl(
  photoId: Id<"photos">,
  variant: PhotoVariant,
  ctx: any,
  fallbackStorageId: Id<"_storage">,
): Promise<string | null> {
  const storageUrl = await ctx.storage.getUrl(fallbackStorageId);
  if (!storageUrl) {
    return null;
  }

  const url = new URL(storageUrl);
  if (url.hostname.endsWith(".convex.cloud")) {
    url.hostname = url.hostname.replace(".convex.cloud", ".convex.site");
  }
  const token = await createPhotoAccessToken(photoId, variant);
  url.pathname = "/photos";
  url.search = `photoId=${encodeURIComponent(photoId)}&variant=${variant}&token=${encodeURIComponent(token)}`;
  return url.toString();
}

export async function encryptStorageObject(
  ctx: any,
  storageId: Id<"_storage">,
): Promise<{ encryptedStorageId: Id<"_storage">; contentType: string }> {
  const blob = await ctx.storage.get(storageId);
  if (!blob) {
    throw new Error("Storage object not found during encryption");
  }

  const encryptedBlob = await encryptBlob(blob);
  const encryptedStorageId = await ctx.storage.store(encryptedBlob);
  const contentType = blob.type || "application/octet-stream";
  return { encryptedStorageId, contentType };
}

export async function isPhotoUploadMaintenanceEnabled(ctx: any): Promise<{
  enabled: boolean;
  message?: string;
}> {
  const row = await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q: any) => q.eq("key", MAINTENANCE_KEY))
    .unique();

  return {
    enabled: row?.booleanValue === true,
    message: row?.stringValue || undefined,
  };
}

export function getEncryptionVersion(): number {
  return ENCRYPTION_VERSION;
}

export async function createPhotoAccessToken(
  photoId: Id<"photos">,
  variant: PhotoVariant,
): Promise<string> {
  const payload: PhotoUrlTokenPayload = {
    photoId,
    variant,
    exp: Date.now() + PHOTO_URL_TOKEN_TTL_MS,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await getPhotoTokenKey();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, payloadBytes);
  const signatureBytes = new Uint8Array(signatureBuffer);
  return `${toBase64Url(payloadBytes)}.${toBase64Url(signatureBytes)}`;
}

export async function validatePhotoAccessToken(
  token: string,
  photoId: Id<"photos">,
  variant: PhotoVariant,
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [payloadPart, signaturePart] = parts;
  if (!payloadPart || !signaturePart) {
    return false;
  }

  try {
    const payloadBytes = fromBase64Url(payloadPart);
    const signatureBytes = fromBase64Url(signaturePart);
    const key = await getPhotoTokenKey();
    const isValidSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      toArrayBuffer(signatureBytes),
      toArrayBuffer(payloadBytes),
    );
    if (!isValidSignature) {
      return false;
    }

    const payload = JSON.parse(
      new TextDecoder().decode(payloadBytes),
    ) as PhotoUrlTokenPayload;
    if (
      payload.photoId !== photoId ||
      payload.variant !== variant ||
      payload.exp < Date.now()
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
