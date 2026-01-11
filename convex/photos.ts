import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Helper function to get photo URLs with backward compatibility
async function getPhotoUrls(photo: any, ctx: any) {
  let thumbnailUrl, mediumUrl, originalUrl;

  if (
    photo.thumbnailStorageId &&
    photo.mediumStorageId &&
    photo.originalStorageId
  ) {
    // New schema with 3 versions (thumbnail, medium, original)
    thumbnailUrl = await ctx.storage.getUrl(photo.thumbnailStorageId);
    mediumUrl = await ctx.storage.getUrl(photo.mediumStorageId);
    originalUrl = await ctx.storage.getUrl(photo.originalStorageId);
  } else if (photo.storageId) {
    // Legacy schema - use same URL for all versions
    const legacyUrl = await ctx.storage.getUrl(photo.storageId);
    thumbnailUrl = legacyUrl;
    mediumUrl = legacyUrl;
    originalUrl = legacyUrl;
  } else {
    // Invalid photo
    thumbnailUrl = null;
    mediumUrl = null;
    originalUrl = null;
  }

  return { thumbnailUrl, mediumUrl, originalUrl };
}

// Generate upload URL for photos
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// Upload a photo with multiple versions (thumbnail, medium, original)
export const uploadPhoto = mutation({
  args: {
    thumbnailStorageId: v.id("_storage"),
    mediumStorageId: v.id("_storage"),
    originalStorageId: v.id("_storage"),
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    isNSFW: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify all storage IDs exist
    const thumbnailMetadata = await ctx.db.system.get(args.thumbnailStorageId);
    const mediumMetadata = await ctx.db.system.get(args.mediumStorageId);
    const originalMetadata = await ctx.db.system.get(args.originalStorageId);

    if (!thumbnailMetadata || !mediumMetadata || !originalMetadata) {
      throw new Error("One or more uploaded files not found in storage");
    }

    // No file size validation needed - client-side compression handles bandwidth

    return await ctx.db.insert("photos", {
      userId,
      thumbnailStorageId: args.thumbnailStorageId,
      mediumStorageId: args.mediumStorageId,
      originalStorageId: args.originalStorageId,
      title: args.title,
      description: args.description,
      tags: args.tags,
      isNSFW: args.isNSFW,
    });
  },
});

// Get all photos in chronological order (main feed) - legacy, use getPaginatedFeed instead
export const getChronologicalFeed = query({
  args: {},
  handler: async (ctx) => {
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
          ...photo,
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

        // Handle both old (storageId) and new (multi-version) schema
        let thumbnailUrl, mediumUrl, url;
        if (
          photo.thumbnailStorageId &&
          photo.mediumStorageId &&
          photo.originalStorageId
        ) {
          // New schema with multiple versions
          thumbnailUrl = await ctx.storage.getUrl(photo.thumbnailStorageId);
          mediumUrl = await ctx.storage.getUrl(photo.mediumStorageId);
          url = await ctx.storage.getUrl(photo.originalStorageId);
        } else if (photo.storageId) {
          // Legacy schema - use same URL for all versions
          const legacyUrl = await ctx.storage.getUrl(photo.storageId);
          thumbnailUrl = legacyUrl;
          mediumUrl = legacyUrl;
          url = legacyUrl;
        } else {
          // Invalid photo - skip
          thumbnailUrl = null;
          mediumUrl = null;
          url = null;
        }

        return {
          ...photo,
          thumbnailUrl,
          mediumUrl,
          url,
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
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    return Promise.all(
      photos.map(async (photo) => {
        // Handle both old (storageId) and new (multi-version) schema
        let thumbnailUrl, mediumUrl, url;
        if (
          photo.thumbnailStorageId &&
          photo.mediumStorageId &&
          photo.originalStorageId
        ) {
          thumbnailUrl = await ctx.storage.getUrl(photo.thumbnailStorageId);
          mediumUrl = await ctx.storage.getUrl(photo.mediumStorageId);
          url = await ctx.storage.getUrl(photo.originalStorageId);
        } else if (photo.storageId) {
          const legacyUrl = await ctx.storage.getUrl(photo.storageId);
          thumbnailUrl = legacyUrl;
          mediumUrl = legacyUrl;
          url = legacyUrl;
        } else {
          thumbnailUrl = null;
          mediumUrl = null;
          url = null;
        }

        return {
          ...photo,
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
        if (
          photo.thumbnailStorageId &&
          photo.mediumStorageId &&
          photo.originalStorageId
        ) {
          thumbnailUrl = await ctx.storage.getUrl(photo.thumbnailStorageId);
          mediumUrl = await ctx.storage.getUrl(photo.mediumStorageId);
          url = await ctx.storage.getUrl(photo.originalStorageId);
        } else if (photo.storageId) {
          const legacyUrl = await ctx.storage.getUrl(photo.storageId);
          thumbnailUrl = legacyUrl;
          mediumUrl = legacyUrl;
          url = legacyUrl;
        } else {
          thumbnailUrl = null;
          mediumUrl = null;
          url = null;
        }

        return {
          ...photo,
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
    if (
      photo.thumbnailStorageId &&
      photo.mediumStorageId &&
      photo.originalStorageId
    ) {
      thumbnailUrl = await ctx.storage.getUrl(photo.thumbnailStorageId);
      mediumUrl = await ctx.storage.getUrl(photo.mediumStorageId);
      url = await ctx.storage.getUrl(photo.originalStorageId);
    } else if (photo.storageId) {
      const legacyUrl = await ctx.storage.getUrl(photo.storageId);
      thumbnailUrl = legacyUrl;
      mediumUrl = legacyUrl;
      url = legacyUrl;
    } else {
      thumbnailUrl = null;
      mediumUrl = null;
      url = null;
    }

    return {
      ...photo,
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
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_photo", (q) => q.eq("photoId", args.photoId))
      .order("desc")
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
