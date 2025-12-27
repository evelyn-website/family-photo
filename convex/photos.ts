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

    return await ctx.db.insert("photos", {
      userId,
      storageId: args.storageId,
      title: args.title,
      description: args.description,
      tags: args.tags,
    });
  },
});

// Get all photos in chronological order (main feed)
export const getChronologicalFeed = query({
  args: {},
  handler: async (ctx) => {
    const photos = await ctx.db
      .query("photos")
      .order("desc")
      .collect();

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
            name: profile?.displayName || user?.name || user?.email || "Anonymous",
            email: user?.email,
          },
        };
      })
    );
  },
});

// Get photos by user
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
      .collect();

    const commentsWithUsers = await Promise.all(
      comments.map(async (comment) => {
        const commentUser = await ctx.db.get(comment.userId);
        const commentProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", comment.userId))
          .unique();
        
        return {
          ...comment,
          user: {
            name: commentProfile?.displayName || commentUser?.name || commentUser?.email || "Anonymous",
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

// Add comment to photo
export const addComment = mutation({
  args: {
    photoId: v.id("photos"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("comments", {
      photoId: args.photoId,
      userId,
      content: args.content,
    });
  },
});
