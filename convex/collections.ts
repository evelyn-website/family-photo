import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Create a collection
export const createCollection = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("collections", {
      userId,
      name: args.name,
      description: args.description,
      isPublic: args.isPublic,
    });
  },
});

// Get user's collections
export const getUserCollections = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    
    let collections = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // If viewing someone else's profile, only show public collections
    if (currentUserId !== args.userId) {
      collections = collections.filter(c => c.isPublic);
    }

    return Promise.all(
      collections.map(async (collection) => {
        const photoCount = await ctx.db
          .query("collectionPhotos")
          .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
          .collect();

        return {
          ...collection,
          photoCount: photoCount.length,
        };
      })
    );
  },
});

// Get collection with photos
export const getCollection = query({
  args: { collectionId: v.id("collections") },
  handler: async (ctx, args) => {
    const collection = await ctx.db.get(args.collectionId);
    if (!collection) return null;

    const currentUserId = await getAuthUserId(ctx);
    
    // Check if user can view this collection
    if (!collection.isPublic && currentUserId !== collection.userId) {
      return null;
    }

    const collectionPhotos = await ctx.db
      .query("collectionPhotos")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .collect();

    const photos = await Promise.all(
      collectionPhotos.map(async (cp) => {
        const photo = await ctx.db.get(cp.photoId);
        if (!photo) return null;

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
          },
        };
      })
    );

    const owner = await ctx.db.get(collection.userId);
    const ownerProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", collection.userId))
      .unique();

    return {
      ...collection,
      owner: {
        name: ownerProfile?.displayName || owner?.name || owner?.email || "Anonymous",
      },
      photos: photos.filter(Boolean),
    };
  },
});

// Add photo to collection
export const addPhotoToCollection = mutation({
  args: {
    collectionId: v.id("collections"),
    photoId: v.id("photos"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found or not owned by user");
    }

    // Check if photo is already in collection
    const existing = await ctx.db
      .query("collectionPhotos")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .filter((q) => q.eq(q.field("photoId"), args.photoId))
      .unique();

    if (existing) {
      throw new Error("Photo already in collection");
    }

    return await ctx.db.insert("collectionPhotos", {
      collectionId: args.collectionId,
      photoId: args.photoId,
    });
  },
});

// Remove photo from collection
export const removePhotoFromCollection = mutation({
  args: {
    collectionId: v.id("collections"),
    photoId: v.id("photos"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const collection = await ctx.db.get(args.collectionId);
    if (!collection || collection.userId !== userId) {
      throw new Error("Collection not found or not owned by user");
    }

    const collectionPhoto = await ctx.db
      .query("collectionPhotos")
      .withIndex("by_collection", (q) => q.eq("collectionId", args.collectionId))
      .filter((q) => q.eq(q.field("photoId"), args.photoId))
      .unique();

    if (collectionPhoto) {
      await ctx.db.delete(collectionPhoto._id);
    }
  },
});

// Get public collections
export const getPublicCollections = query({
  args: {},
  handler: async (ctx) => {
    const collections = await ctx.db
      .query("collections")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .collect();

    return Promise.all(
      collections.map(async (collection) => {
        const owner = await ctx.db.get(collection.userId);
        const ownerProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", collection.userId))
          .unique();

        const photoCount = await ctx.db
          .query("collectionPhotos")
          .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
          .collect();

        return {
          ...collection,
          owner: {
            name: ownerProfile?.displayName || owner?.name || owner?.email || "Anonymous",
          },
          photoCount: photoCount.length,
        };
      })
    );
  },
});
