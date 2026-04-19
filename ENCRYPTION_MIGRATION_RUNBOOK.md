# Photo Encryption Migration Runbook

## Scope

This runbook migrates existing `photos` storage objects from plaintext to
application-layer encrypted blobs while keeping image delivery working via
signed `GET /photos` URLs.

## Prerequisites

1. Deploy code that includes:
   - encrypted upload path in `convex/photos.ts`
   - signed-token/decrypting image endpoint in `convex/http.ts`
   - migration functions in `convex/photos.ts`
2. Set Convex env var `PHOTO_ENCRYPTION_KEY` to a base64-encoded 32-byte key.
   - Example generation:
     - `openssl rand -base64 32`
3. Set Convex env var `PHOTO_ALLOWED_ORIGINS` to your frontend origins:
   - Example:
     - `http://localhost:5173,http://127.0.0.1:5173,https://your-prod-domain.com`
4. Confirm admin access (required for maintenance + migration mutations).

## Preflight Checks

1. Confirm status before migration:
   - Run `photos:getPhotoMigrationStatus` in Convex dashboard.
2. Enable maintenance mode to pause new uploads:
   - Run `photos:setPhotoUploadMaintenance` with:
     - `enabled: true`
     - `message: "Uploads are paused for encryption migration."`
3. Verify uploads are blocked in UI and `photos:generateUploadUrl` throws.

## Migration Execution

1. Start migration batch:
   - Run `photos:startPhotoMigration` with:
     - `batchSize: 10` (or lower/higher based on image sizes)
2. Poll progress:
   - Re-run `photos:getPhotoMigrationStatus` until `pendingCount` is `0`.
3. If `pendingCount` stays above `0`, run `photos:startPhotoMigration` again.
4. For dev-only direct execution (without dashboard auth context), use:
   - `photos:runPhotoMigrationForDev` (optional helper)

## Validation

1. Verify decrypted access still works:
   - Open app feed and modal; confirm thumbnails, medium, and original load.
2. Verify unsigned access is blocked:
   - Request `/photos?photoId=...&variant=original` should return `401` (`Missing token`).
3. Verify invalid token access is blocked:
   - Request `/photos?...&token=invalid` should return `401` (`Invalid token`).
4. Verify CORS restrictions:
   - Requests from origins not listed in `PHOTO_ALLOWED_ORIGINS` should not receive
     `Access-Control-Allow-Origin`.
5. Verify raw storage URLs are ciphertext:
   - Open `/api/storage/<id>` for a migrated file and confirm response is not a
     valid image payload.
6. Re-run `npm run lint` and confirm success.

## Rollback Plan

1. Keep maintenance mode enabled.
2. Roll back to previous deployment.
3. If needed, restore from Convex backup/snapshot for fully consistent state.
4. Disable maintenance mode after rollback validation.

## Completion

1. Disable maintenance mode:
   - `photos:setPhotoUploadMaintenance` with `enabled: false`.
2. Final check:
   - `photos:getPhotoMigrationStatus` should report all encrypted.
3. Spot-check uploads:
   - Upload a new photo and confirm thumbnail/medium/original render as expected.
