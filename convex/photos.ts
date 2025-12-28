import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

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

// Upload a photo
export const uploadPhoto = mutation({
  args: {
    storageId: v.id("_storage"),
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Validate file size from storage metadata
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
    const fileMetadata = await ctx.db.system.get(args.storageId);

    if (!fileMetadata) {
      throw new Error("File not found in storage");
    }

    // Check if file size exceeds limit
    if (fileMetadata.size > MAX_FILE_SIZE) {
      // Delete the uploaded file since it exceeds the limit
      await ctx.storage.delete(args.storageId);
      throw new Error(
        `File size (${(fileMetadata.size / (1024 * 1024)).toFixed(1)}MB) exceeds the 10MB limit`
      );
    }

    return await ctx.db.insert("photos", {
      userId,
      storageId: args.storageId,
      title: args.title,
      description: args.description,
      tags: args.tags,
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

        return {
          ...photo,
          url: await ctx.storage.getUrl(photo.storageId),
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

        return {
          ...photo,
          url: await ctx.storage.getUrl(photo.storageId),
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
      photos.map(async (photo) => ({
        ...photo,
        url: await ctx.storage.getUrl(photo.storageId),
      }))
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
      pagePhotos.map(async (photo) => ({
        ...photo,
        url: await ctx.storage.getUrl(photo.storageId),
      }))
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

    return {
      ...photo,
      url: await ctx.storage.getUrl(photo.storageId),
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

    // Delete the storage file
    await ctx.storage.delete(photo.storageId);

    // Delete the photo record
    await ctx.db.delete(args.photoId);
  },
});
