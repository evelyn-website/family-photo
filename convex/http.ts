import { auth } from "./auth";
import router from "./router";
import { httpAction } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  decryptBlob,
  getPhotoVariantContentType,
  getPhotoVariantStorageId,
  PhotoVariant,
  validatePhotoAccessToken,
} from "./photoSecurity";

const http = router;

auth.addHttpRoutes(http);

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const configuredOrigins = process.env.PHOTO_ALLOWED_ORIGINS;
  if (configuredOrigins) {
    for (const origin of configuredOrigins.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) {
        origins.add(trimmed);
      }
    }
  }

  const siteUrl = process.env.SITE_URL;
  if (siteUrl) {
    try {
      origins.add(new URL(siteUrl).origin);
    } catch {
      // Ignore malformed SITE_URL values.
    }
  }

  return origins;
}

function getAllowedOriginForRequest(req: Request): string | null {
  const requestOrigin = req.headers.get("origin");
  if (!requestOrigin) {
    return null;
  }
  const allowedOrigins = getAllowedOrigins();
  return allowedOrigins.has(requestOrigin) ? requestOrigin : null;
}

function withCorsHeaders(
  req: Request,
  headers: Record<string, string> = {}
) {
  const allowedOrigin = getAllowedOriginForRequest(req);
  return {
    ...(allowedOrigin
      ? {
          "Access-Control-Allow-Origin": allowedOrigin,
          Vary: "Origin",
        }
      : {}),
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...headers,
  };
}

function corsResponse(
  req: Request,
  body: BodyInit | null,
  status: number,
  headers: Record<string, string> = {}
) {
  return new Response(body, {
    status,
    headers: withCorsHeaders(req, headers),
  });
}

http.route({
  path: "/photos",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, req) => {
    return corsResponse(req, null, 204);
  }),
});

http.route({
  path: "/photos",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const requestUrl = new URL(req.url);
    const photoId = requestUrl.searchParams.get("photoId") as Id<"photos"> | null;
    const variant = (requestUrl.searchParams.get("variant") ||
      "original") as PhotoVariant;
    const token = requestUrl.searchParams.get("token");

    if (!photoId) {
      return corsResponse(req, "Missing photoId", 400);
    }

    if (!["thumbnail", "medium", "original"].includes(variant)) {
      return corsResponse(req, "Invalid variant", 400);
    }

    if (!token) {
      return corsResponse(req, "Missing token", 401);
    }

    const isValidToken = await validatePhotoAccessToken(token, photoId, variant);
    if (!isValidToken) {
      return corsResponse(req, "Invalid token", 401);
    }

    const photo = await ctx.runQuery(internal.photos.getPhotoForServing, { photoId });
    if (!photo) {
      return corsResponse(req, "Photo not found", 404);
    }

    const storageId = getPhotoVariantStorageId(photo, variant);
    if (!storageId) {
      return corsResponse(req, "Photo variant not found", 404);
    }

    const blob = await ctx.storage.get(storageId);
    if (!blob) {
      return corsResponse(req, "Photo not found", 404);
    }

    const outputBlob =
      photo.isEncrypted === true
        ? await decryptBlob(blob, getPhotoVariantContentType(photo, variant))
        : blob;

    return corsResponse(req, outputBlob, 200, {
        "Content-Type": outputBlob.type || "application/octet-stream",
        "Cache-Control": "private, max-age=60",
    });
  }),
});

export default http;
