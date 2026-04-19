import { v } from "convex/values";
import {
  query,
  mutation,
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  buildPhotoProxyUrl,
  encryptStorageObject,
  getEncryptionVersion,
  getPhotoVariantStorageId,
  isPhotoUploadMaintenanceEnabled,
} from "./photoSecurity";

async function requireAuthenticatedUserId(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

async function getPhotoUrls(photo: any, ctx: any) {
  let thumbnailUrl, mediumUrl, originalUrl;

  const thumbnailStorageId = getPhotoVariantStorageId(photo, "thumbnail");
  const mediumStorageId = getPhotoVariantStorageId(photo, "medium");
  const originalStorageId = getPhotoVariantStorageId(photo, "original");

  if (thumbnailStorageId && mediumStorageId && originalStorageId) {
    thumbnailUrl = await buildPhotoProxyUrl(
      photo._id,
      "thumbnail",
      ctx,
      thumbnailStorageId
    );
    mediumUrl = await buildPhotoProxyUrl(photo._id, "medium", ctx, mediumStorageId);
    originalUrl = await buildPhotoProxyUrl(
      photo._id,
      "original",
      ctx,
      originalStorageId
    );
  } else {
    thumbnailUrl = null;
    mediumUrl = null;
    originalUrl = null;
  }

  return { thumbnailUrl, mediumUrl, originalUrl };
}

function sanitizePhotoForClient(photo: any) {
  const {
    storageId: _storageId,
    thumbnailStorageId: _thumbnailStorageId,
    mediumStorageId: _mediumStorageId,
    originalStorageId: _originalStorageId,
    isEncrypted: _isEncrypted,
    encryptionVersion: _encryptionVersion,
    thumbnailContentType: _thumbnailContentType,
    mediumContentType: _mediumContentType,
    originalContentType: _originalContentType,
    ...publicPhoto
  } = photo;
  return publicPhoto;
}

async function encryptAndStorePhotoVersions(
  ctx: any,
  input: {
    thumbnailStorageId: any;
    mediumStorageId: any;
    originalStorageId: any;
  }
) {
  const thumbnail = await encryptStorageObject(ctx, input.thumbnailStorageId);
  const medium = await encryptStorageObject(ctx, input.mediumStorageId);
  const original = await encryptStorageObject(ctx, input.originalStorageId);

  return {
    thumbnailStorageId: thumbnail.encryptedStorageId,
    mediumStorageId: medium.encryptedStorageId,
    originalStorageId: original.encryptedStorageId,
    thumbnailContentType: thumbnail.contentType,
    mediumContentType: medium.contentType,
    originalContentType: original.contentType,
    isEncrypted: true,
    encryptionVersion: getEncryptionVersion(),
  };
}

// Generate upload URL for photos
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const maintenance = await isPhotoUploadMaintenanceEnabled(ctx);
    if (maintenance.enabled) {
      throw new Error(
        maintenance.message || "Photo uploads are temporarily unavailable"
      );
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const createEncryptedPhotoRecord = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    isNSFW: v.optional(v.boolean()),
    thumbnailStorageId: v.id("_storage"),
    mediumStorageId: v.id("_storage"),
    originalStorageId: v.id("_storage"),
    thumbnailContentType: v.string(),
    mediumContentType: v.string(),
    originalContentType: v.string(),
    encryptionVersion: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("photos", {
      userId: args.userId,
      title: args.title,
      description: args.description,
      tags: args.tags,
      isNSFW: args.isNSFW,
      thumbnailStorageId: args.thumbnailStorageId,
      mediumStorageId: args.mediumStorageId,
      originalStorageId: args.originalStorageId,
      thumbnailContentType: args.thumbnailContentType,
      mediumContentType: args.mediumContentType,
      originalContentType: args.originalContentType,
      isEncrypted: true,
      encryptionVersion: args.encryptionVersion,
    });
  },
});

// Upload a photo with multiple versions (thumbnail, medium, original)
export const uploadPhoto = action({
  args: {
    thumbnailStorageId: v.id("_storage"),
    mediumStorageId: v.id("_storage"),
    originalStorageId: v.id("_storage"),
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    isNSFW: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<Id<"photos">> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const maintenance = await ctx.runQuery(
      internal.photos.getPhotoUploadMaintenanceInternal,
      {}
    );
    if (maintenance.enabled) {
      throw new Error(
        maintenance.message || "Photo uploads are temporarily unavailable"
      );
    }

    const thumbnailBlob = await ctx.storage.get(args.thumbnailStorageId);
    const mediumBlob = await ctx.storage.get(args.mediumStorageId);
    const originalBlob = await ctx.storage.get(args.originalStorageId);
    if (!thumbnailBlob || !mediumBlob || !originalBlob) {
      throw new Error("One or more uploaded files not found in storage");
    }

    const encryptedVersions = await encryptAndStorePhotoVersions(ctx, {
      thumbnailStorageId: args.thumbnailStorageId,
      mediumStorageId: args.mediumStorageId,
      originalStorageId: args.originalStorageId,
    });

    await ctx.storage.delete(args.thumbnailStorageId);
    await ctx.storage.delete(args.mediumStorageId);
    await ctx.storage.delete(args.originalStorageId);

    return await ctx.runMutation(internal.photos.createEncryptedPhotoRecord, {
      userId,
      title: args.title,
      description: args.description,
      tags: args.tags,
      isNSFW: args.isNSFW,
      thumbnailStorageId: encryptedVersions.thumbnailStorageId,
      mediumStorageId: encryptedVersions.mediumStorageId,
      originalStorageId: encryptedVersions.originalStorageId,
      thumbnailContentType: encryptedVersions.thumbnailContentType,
      mediumContentType: encryptedVersions.mediumContentType,
      originalContentType: encryptedVersions.originalContentType,
      encryptionVersion: encryptedVersions.encryptionVersion,
    });
  },
});

export const getPhotoUploadMaintenance = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUserId(ctx);
    return await isPhotoUploadMaintenanceEnabled(ctx);
  },
});

export const getPhotoUploadMaintenanceInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await isPhotoUploadMaintenanceEnabled(ctx);
  },
});

export const setPhotoUploadMaintenance = mutation({
  args: {
    enabled: v.boolean(),
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile?.isAdmin) {
      throw new Error("Admin access required");
    }

    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", "photoUploadsMaintenance"))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        booleanValue: args.enabled,
        stringValue: args.message,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: "photoUploadsMaintenance",
        booleanValue: args.enabled,
        stringValue: args.message,
        updatedAt: Date.now(),
        updatedBy: userId,
      });
    }
  },
});

// Get all photos in chronological order (main feed) - legacy, use getPaginatedFeed instead
export const getChronologicalFeed = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUserId(ctx);
    const photos = await ctx.db.query("photos").order("desc").collect();

    return Promise.all(
      photos.map(async (photo) => {
        const user = await ctx.db.get(photo.userId);
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", photo.userId))
          .unique();

        const { thumbnailUrl, mediumUrl, originalUrl } = await getPhotoUrls(
          photo,
          ctx
        );

        return {
          ...sanitizePhotoForClient(photo),
          thumbnailUrl,
          mediumUrl,
          url: originalUrl, // Keep 'url' field for backward compatibility
          user: {
            name:
              profile?.displayName || user?.name || user?.email || "Anonymous",
            email: user?.email,
          },
        };
      })
    );
  },
});

// Get paginated photos for the main feed
export const getPaginatedFeed = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedUserId(ctx);
    const { pageSize } = args;

    // Get total count for pagination info
    const allPhotos = await ctx.db.query("photos").collect();
    const totalCount = allPhotos.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Clamp page to valid range
    const page = Math.max(1, Math.min(args.page, totalPages));
    const offset = (page - 1) * pageSize;

    // Get photos for current page (fetch offset + pageSize and slice)
    const photos = await ctx.db
      .query("photos")
      .order("desc")
      .take(offset + pageSize);

    // Slice to get only the current page
    const pagePhotos = photos.slice(offset);

    const photosWithDetails = await Promise.all(
      pagePhotos.map(async (photo) => {
        const user = await ctx.db.get(photo.userId);
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", photo.userId))
          .unique();

        // Get comment count for this photo
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_photo", (q) => q.eq("photoId", photo._id))
          .collect();
        const commentCount = comments.length;

        // Handle both old (storageId) and new (multi-version) schema
        let thumbnailUrl, mediumUrl, url;
        const thumbnailStorageId = getPhotoVariantStorageId(photo, "thumbnail");
        const mediumStorageId = getPhotoVariantStorageId(photo, "medium");
        const originalStorageId = getPhotoVariantStorageId(photo, "original");
        if (thumbnailStorageId && mediumStorageId && originalStorageId) {
          thumbnailUrl = await buildPhotoProxyUrl(
            photo._id,
            "thumbnail",
            ctx,
            thumbnailStorageId
          );
          mediumUrl = await buildPhotoProxyUrl(
            photo._id,
            "medium",
            ctx,
            mediumStorageId
          );
          url = await buildPhotoProxyUrl(
            photo._id,
            "original",
            ctx,
            originalStorageId
          );
        } else {
          thumbnailUrl = null;
          mediumUrl = null;
          url = null;
        }

        return {
          ...sanitizePhotoForClient(photo),
          thumbnailUrl,
          mediumUrl,
          url,
          commentCount,
          user: {
            name:
              profile?.displayName || user?.name || user?.email || "Anonymous",
            email: user?.email,
          },
        };
      })
    );

    return {
      photos: photosWithDetails,
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  },
});

// Get photos by user - legacy, use getPaginatedUserPhotos instead
export const getUserPhotos = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUserId(ctx);
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return Promise.all(
      photos.map(async (photo) => {
        // Handle both old (storageId) and new (multi-version) schema
        let thumbnailUrl, mediumUrl, url;
        const thumbnailStorageId = getPhotoVariantStorageId(photo, "thumbnail");
        const mediumStorageId = getPhotoVariantStorageId(photo, "medium");
        const originalStorageId = getPhotoVariantStorageId(photo, "original");
        if (thumbnailStorageId && mediumStorageId && originalStorageId) {
          thumbnailUrl = await buildPhotoProxyUrl(
            photo._id,
            "thumbnail",
            ctx,
            thumbnailStorageId
          );
          mediumUrl = await buildPhotoProxyUrl(
            photo._id,
            "medium",
            ctx,
            mediumStorageId
          );
          url = await buildPhotoProxyUrl(
            photo._id,
            "original",
            ctx,
            originalStorageId
          );
        } else {
          thumbnailUrl = null;
          mediumUrl = null;
          url = null;
        }

        return {
          ...sanitizePhotoForClient(photo),
          thumbnailUrl,
          mediumUrl,
          url,
        };
      })
    );
  },
});

// Get paginated photos by user
export const getPaginatedUserPhotos = query({
  args: {
    userId: v.id("users"),
    page: v.number(),
    pageSize: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedUserId(ctx);
    const { userId, pageSize } = args;

    // Get all photos for count
    const allPhotos = await ctx.db
      .query("photos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const totalCount = allPhotos.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Clamp page to valid range
    const page = Math.max(1, Math.min(args.page, totalPages));
    const offset = (page - 1) * pageSize;

    // Get photos for current page
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(offset + pageSize);

    const pagePhotos = photos.slice(offset);

    const photosWithUrls = await Promise.all(
      pagePhotos.map(async (photo) => {
        // Handle both old (storageId) and new (multi-version) schema
        let thumbnailUrl, mediumUrl, url;
        const thumbnailStorageId = getPhotoVariantStorageId(photo, "thumbnail");
        const mediumStorageId = getPhotoVariantStorageId(photo, "medium");
        const originalStorageId = getPhotoVariantStorageId(photo, "original");
        if (thumbnailStorageId && mediumStorageId && originalStorageId) {
          thumbnailUrl = await buildPhotoProxyUrl(
            photo._id,
            "thumbnail",
            ctx,
            thumbnailStorageId
          );
          mediumUrl = await buildPhotoProxyUrl(
            photo._id,
            "medium",
            ctx,
            mediumStorageId
          );
          url = await buildPhotoProxyUrl(
            photo._id,
            "original",
            ctx,
            originalStorageId
          );
        } else {
          thumbnailUrl = null;
          mediumUrl = null;
          url = null;
        }

        return {
          ...sanitizePhotoForClient(photo),
          thumbnailUrl,
          mediumUrl,
          url,
        };
      })
    );

    return {
      photos: photosWithUrls,
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  },
});

// Get single photo with details
export const getPhoto = query({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUserId(ctx);
    const photo = await ctx.db.get(args.photoId);
    if (!photo) return null;

    const user = await ctx.db.get(photo.userId);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", photo.userId))
      .unique();

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_photo", (q) => q.eq("photoId", args.photoId))
      .order("desc")
      .collect();

    const commentsWithUsers = await Promise.all(
      comments.map(async (comment) => {
        let userName = "Anonymous";
        if (comment.userId) {
          const userId = comment.userId; // Type narrowing for TypeScript
          const commentUser = await ctx.db.get(userId);
          const commentProfile = await ctx.db
            .query("profiles")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .unique();

          // Prioritize email over "Anonymous" for authenticated users
          userName =
            commentProfile?.displayName ||
            commentUser?.name ||
            commentUser?.email ||
            "Anonymous";
        }

        return {
          ...comment,
          user: {
            name: userName,
          },
        };
      })
    );

    // Handle both old (storageId) and new (multi-version) schema
    let thumbnailUrl, mediumUrl, url;
    const thumbnailStorageId = getPhotoVariantStorageId(photo, "thumbnail");
    const mediumStorageId = getPhotoVariantStorageId(photo, "medium");
    const originalStorageId = getPhotoVariantStorageId(photo, "original");
    if (thumbnailStorageId && mediumStorageId && originalStorageId) {
      thumbnailUrl = await buildPhotoProxyUrl(
        photo._id,
        "thumbnail",
        ctx,
        thumbnailStorageId
      );
      mediumUrl = await buildPhotoProxyUrl(photo._id, "medium", ctx, mediumStorageId);
      url = await buildPhotoProxyUrl(
        photo._id,
        "original",
        ctx,
        originalStorageId
      );
    } else {
      thumbnailUrl = null;
      mediumUrl = null;
      url = null;
    }

    return {
      ...sanitizePhotoForClient(photo),
      thumbnailUrl,
      mediumUrl,
      url,
      user: {
        name: profile?.displayName || user?.name || user?.email || "Anonymous",
        email: user?.email,
      },
      comments: commentsWithUsers,
    };
  },
});

// Get comments for a photo (for lazy loading)
export const getPhotoComments = query({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUserId(ctx);
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_photo", (q) => q.eq("photoId", args.photoId))
      .order("asc")
      .collect();

    const commentsWithUsers = await Promise.all(
      comments.map(async (comment) => {
        let userName = "Anonymous";
        if (comment.userId) {
          const userId = comment.userId;
          const commentUser = await ctx.db.get(userId);
          const commentProfile = await ctx.db
            .query("profiles")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .unique();

          // Prioritize email over "Anonymous" for authenticated users
          userName =
            commentProfile?.displayName ||
            commentUser?.name ||
            commentUser?.email ||
            "Anonymous";
        }

        return {
          ...comment,
          user: {
            name: userName,
          },
        };
      })
    );

    return commentsWithUsers;
  },
});

export const listPhotosPendingEncryptionMigration = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const photos = await ctx.db.query("photos").order("asc").collect();
    return photos
      .filter((photo) => photo.isEncrypted !== true)
      .slice(0, args.limit)
      .map((photo) => photo._id);
  },
});

export const getPhotoForServing = internalQuery({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.photoId);
  },
});

export const applyPhotoEncryptionMigration = internalMutation({
  args: {
    photoId: v.id("photos"),
    thumbnailStorageId: v.id("_storage"),
    mediumStorageId: v.id("_storage"),
    originalStorageId: v.id("_storage"),
    thumbnailContentType: v.string(),
    mediumContentType: v.string(),
    originalContentType: v.string(),
    encryptionVersion: v.number(),
    oldStorageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const photo = await ctx.db.get(args.photoId);
    if (!photo || photo.isEncrypted === true) {
      return { migrated: false };
    }

    await ctx.db.patch(args.photoId, {
      thumbnailStorageId: args.thumbnailStorageId,
      mediumStorageId: args.mediumStorageId,
      originalStorageId: args.originalStorageId,
      thumbnailContentType: args.thumbnailContentType,
      mediumContentType: args.mediumContentType,
      originalContentType: args.originalContentType,
      isEncrypted: true,
      encryptionVersion: args.encryptionVersion,
      storageId: undefined,
    });

    return { migrated: true };
  },
});

export const migrateSinglePhotoToEncryptedStorage = internalAction({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const photo = await ctx.runQuery(internal.photos.getPhotoForServing, {
      photoId: args.photoId,
    });
    if (!photo || photo.isEncrypted === true) {
      return { migrated: false };
    }

    let sourceThumbnailStorageId = photo.thumbnailStorageId;
    let sourceMediumStorageId = photo.mediumStorageId;
    let sourceOriginalStorageId = photo.originalStorageId;

    if (!sourceThumbnailStorageId || !sourceMediumStorageId || !sourceOriginalStorageId) {
      if (!photo.storageId) {
        return { migrated: false };
      }
      sourceThumbnailStorageId = photo.storageId;
      sourceMediumStorageId = photo.storageId;
      sourceOriginalStorageId = photo.storageId;
    }

    const encrypted = await encryptAndStorePhotoVersions(ctx, {
      thumbnailStorageId: sourceThumbnailStorageId,
      mediumStorageId: sourceMediumStorageId,
      originalStorageId: sourceOriginalStorageId,
    });

    const oldStorageIds = Array.from(
      new Set([
        sourceThumbnailStorageId,
        sourceMediumStorageId,
        sourceOriginalStorageId,
        photo.storageId,
      ]).values()
    ).filter((storageId): storageId is Id<"_storage"> => !!storageId);

    const result = await ctx.runMutation(
      internal.photos.applyPhotoEncryptionMigration,
      {
        photoId: args.photoId,
        thumbnailStorageId: encrypted.thumbnailStorageId,
        mediumStorageId: encrypted.mediumStorageId,
        originalStorageId: encrypted.originalStorageId,
        thumbnailContentType: encrypted.thumbnailContentType,
        mediumContentType: encrypted.mediumContentType,
        originalContentType: encrypted.originalContentType,
        encryptionVersion: encrypted.encryptionVersion,
        oldStorageIds,
      }
    );

    if (!result.migrated) {
      return { migrated: false };
    }

    for (const oldStorageId of oldStorageIds) {
      await ctx.storage.delete(oldStorageId);
    }

    return { migrated: true };
  },
});

export const getPhotoMigrationStatusInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const photos = await ctx.db.query("photos").collect();
    const encryptedCount = photos.filter((photo) => photo.isEncrypted === true).length;
    const totalCount = photos.length;
    return {
      totalCount,
      encryptedCount,
      pendingCount: totalCount - encryptedCount,
    };
  },
});

export const runPhotoMigrationBatchAction = internalAction({
  args: {
    batchSize: v.number(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ migratedCount: number; processedCount: number; hasRemaining: boolean }> => {
    const pendingPhotoIds: Array<Id<"photos">> = await ctx.runQuery(
      internal.photos.listPhotosPendingEncryptionMigration,
      {
        limit: args.batchSize,
      }
    );

    let migratedCount = 0;
    for (const photoId of pendingPhotoIds) {
      const result = await ctx.runAction(
        internal.photos.migrateSinglePhotoToEncryptedStorage,
        { photoId }
      );
      if (result.migrated) {
        migratedCount += 1;
      }
    }

    const remaining = await ctx.runQuery(internal.photos.getPhotoMigrationStatusInternal, {});

    return {
      migratedCount,
      processedCount: pendingPhotoIds.length,
      hasRemaining: remaining.pendingCount > 0,
    };
  },
});

export const runPhotoMigrationUntilDone = internalAction({
  args: { batchSize: v.number() },
  handler: async (ctx, args) => {
    let totalMigrated = 0;
    while (true) {
      const batchResult = await ctx.runAction(
        internal.photos.runPhotoMigrationBatchAction,
        {
          batchSize: args.batchSize,
        }
      );
      totalMigrated += batchResult.migratedCount;
      if (!batchResult.hasRemaining || batchResult.processedCount === 0) {
        return { totalMigrated };
      }
    }
  },
});

export const runPhotoMigrationForDev = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const batchSize = Math.max(1, Math.min(args.batchSize ?? 10, 100));
    await ctx.scheduler.runAfter(0, internal.photos.runPhotoMigrationUntilDone, {
      batchSize,
    });
    return { scheduled: true, batchSize };
  },
});

export const startPhotoMigration = mutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthenticatedUserId(ctx);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile?.isAdmin) {
      throw new Error("Admin access required");
    }

    const batchSize = Math.max(1, Math.min(args.batchSize ?? 10, 100));
    await ctx.scheduler.runAfter(0, internal.photos.runPhotoMigrationUntilDone, {
      batchSize,
    });

    return { scheduled: true, batchSize };
  },
});

export const getPhotoMigrationStatus = query({
  args: {},
  handler: async (
    ctx
  ): Promise<{ totalCount: number; encryptedCount: number; pendingCount: number }> => {
    await requireAuthenticatedUserId(ctx);
    return await ctx.runQuery(internal.photos.getPhotoMigrationStatusInternal, {});
  },
});

// Add comment to photo
export const addComment = mutation({
  args: {
    photoId: v.id("photos"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    // Allow anonymous comments - userId is optional

    if (userId) {
      return await ctx.db.insert("comments", {
        photoId: args.photoId,
        userId,
        content: args.content,
      });
    } else {
      return await ctx.db.insert("comments", {
        photoId: args.photoId,
        content: args.content,
      });
    }
  },
});

// Toggle NSFW status for a photo (only the owner can toggle)
export const toggleNSFW = mutation({
  args: {
    photoId: v.id("photos"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the photo and verify ownership
    const photo = await ctx.db.get(args.photoId);
    if (!photo) {
      throw new Error("Photo not found");
    }

    if (photo.userId !== userId) {
      throw new Error("Not authorized to modify this photo");
    }

    // Toggle NSFW status
    await ctx.db.patch(args.photoId, {
      isNSFW: !photo.isNSFW,
    });
  },
});

// Update tags for a photo (only the owner can update)
export const updatePhotoTags = mutation({
  args: {
    photoId: v.id("photos"),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the photo and verify ownership
    const photo = await ctx.db.get(args.photoId);
    if (!photo) {
      throw new Error("Photo not found");
    }

    if (photo.userId !== userId) {
      throw new Error("Not authorized to modify this photo");
    }

    // Update tags
    await ctx.db.patch(args.photoId, {
      tags: args.tags,
    });
  },
});

// Update photo details (title, description, and tags) - only the owner can update
export const updatePhotoDetails = mutation({
  args: {
    photoId: v.id("photos"),
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the photo and verify ownership
    const photo = await ctx.db.get(args.photoId);
    if (!photo) {
      throw new Error("Photo not found");
    }

    if (photo.userId !== userId) {
      throw new Error("Not authorized to modify this photo");
    }

    // Validate title is not empty
    if (!args.title.trim()) {
      throw new Error("Title cannot be empty");
    }

    // Update title, description, and tags
    await ctx.db.patch(args.photoId, {
      title: args.title.trim(),
      description: args.description?.trim() || undefined,
      tags: args.tags,
    });
  },
});

// Delete a photo (only the owner can delete)
export const deletePhoto = mutation({
  args: {
    photoId: v.id("photos"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the photo and verify ownership
    const photo = await ctx.db.get(args.photoId);
    if (!photo) {
      throw new Error("Photo not found");
    }

    if (photo.userId !== userId) {
      throw new Error("Not authorized to delete this photo");
    }

    // Delete all comments for this photo
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_photo", (q) => q.eq("photoId", args.photoId))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Delete all collectionPhotos associations
    const collectionPhotos = await ctx.db
      .query("collectionPhotos")
      .withIndex("by_photo", (q) => q.eq("photoId", args.photoId))
      .collect();
    for (const collectionPhoto of collectionPhotos) {
      await ctx.db.delete(collectionPhoto._id);
    }

    // Delete all editorialPhotos associations
    // Query all editorial periods and check for this photo
    const allPeriods = await ctx.db.query("editorialPeriods").collect();
    for (const period of allPeriods) {
      const editorialPhotos = await ctx.db
        .query("editorialPhotos")
        .withIndex("by_period", (q) => q.eq("periodId", period._id))
        .filter((q) => q.eq(q.field("photoId"), args.photoId))
        .collect();
      for (const editorialPhoto of editorialPhotos) {
        await ctx.db.delete(editorialPhoto._id);
      }
    }

    // Delete the storage files (handle both old and new schema)
    if (
      photo.thumbnailStorageId &&
      photo.mediumStorageId &&
      photo.originalStorageId
    ) {
      // New schema - delete all three versions
      await ctx.storage.delete(photo.thumbnailStorageId);
      await ctx.storage.delete(photo.mediumStorageId);
      await ctx.storage.delete(photo.originalStorageId);
    } else if (photo.storageId) {
      // Legacy schema - delete single file
      await ctx.storage.delete(photo.storageId);
    }

    // Delete the photo record
    await ctx.db.delete(args.photoId);
  },
});
