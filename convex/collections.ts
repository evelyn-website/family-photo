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

    // Prevent creating a collection named "Favorites" (reserved name)
    if (args.name.trim().toLowerCase() === "favorites") {
      throw new Error('"Favorites" is a reserved collection name');
    }

    return await ctx.db.insert("collections", {
      userId,
      name: args.name,
      description: args.description,
      tags: [],
      isPublic: args.isPublic,
    });
  },
});

// Create a collection and add a photo to it in one operation
export const createCollectionAndAddPhoto = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
    photoId: v.id("photos"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Prevent creating a collection named "Favorites" (reserved name)
    if (args.name.trim().toLowerCase() === "favorites") {
      throw new Error('"Favorites" is a reserved collection name');
    }

    // Create the collection
    const collectionId = await ctx.db.insert("collections", {
      userId,
      name: args.name,
      description: args.description,
      tags: [],
      isPublic: args.isPublic,
    });

    // Add photo to collection (check if already exists first)
    const existing = await ctx.db
      .query("collectionPhotos")
      .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
      .filter((q) => q.eq(q.field("photoId"), args.photoId))
      .first();

    if (!existing) {
      await ctx.db.insert("collectionPhotos", {
        collectionId,
        photoId: args.photoId,
      });
    }

    return collectionId;
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
      collections = collections.filter((c) => c.isPublic);
    }

    // Sort collections: Favorites first (by isDefault or name), then others
    collections.sort((a, b) => {
      const aIsDefault =
        a.isDefault === true || a.name.toLowerCase() === "favorites";
      const bIsDefault =
        b.isDefault === true || b.name.toLowerCase() === "favorites";
      if (aIsDefault && !bIsDefault) return -1;
      if (!aIsDefault && bIsDefault) return 1;
      return 0;
    });

    return Promise.all(
      collections.map(async (collection) => {
        const photoCount = await ctx.db
          .query("collectionPhotos")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", collection._id)
          )
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
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId)
      )
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
            name:
              profile?.displayName || user?.name || user?.email || "Anonymous",
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
        name:
          ownerProfile?.displayName ||
          owner?.name ||
          owner?.email ||
          "Anonymous",
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
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId)
      )
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
      .withIndex("by_collection", (q) =>
        q.eq("collectionId", args.collectionId)
      )
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
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", collection._id)
          )
          .collect();

        return {
          ...collection,
          owner: {
            name:
              ownerProfile?.displayName ||
              owner?.name ||
              owner?.email ||
              "Anonymous",
          },
          photoCount: photoCount.length,
        };
      })
    );
  },
});

// Ensure Favorites collection exists for the current user
export const ensureFavoritesCollection = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if Favorites collection already exists
    const existing = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("isDefault"), true),
          q.eq(q.field("name"), "Favorites")
        )
      )
      .first();

    if (existing) {
      // Update existing to ensure isDefault is set
      if (!existing.isDefault) {
        await ctx.db.patch(existing._id, { isDefault: true });
      }
      return existing._id;
    }

    // Create Favorites collection
    return await ctx.db.insert("collections", {
      userId,
      name: "Favorites",
      description: "Your favorite photos",
      tags: [],
      isPublic: false,
      isDefault: true,
    });
  },
});

// Get Favorites collection ID for the current user
export const getFavoritesCollection = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const favorites = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("isDefault"), true),
          q.eq(q.field("name"), "Favorites")
        )
      )
      .first();

    return favorites?._id ?? null;
  },
});

// Check if a photo is in the user's Favorites collection
export const isPhotoInFavorites = query({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const favorites = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("isDefault"), true),
          q.eq(q.field("name"), "Favorites")
        )
      )
      .first();

    if (!favorites) {
      return false;
    }

    const collectionPhoto = await ctx.db
      .query("collectionPhotos")
      .withIndex("by_collection", (q) => q.eq("collectionId", favorites._id))
      .filter((q) => q.eq(q.field("photoId"), args.photoId))
      .first();

    return collectionPhoto !== null;
  },
});

// Get favorite status for multiple photos at once
export const getPhotosFavoriteStatus = query({
  args: { photoIds: v.array(v.id("photos")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || args.photoIds.length === 0) {
      return {};
    }

    const favorites = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("isDefault"), true),
          q.eq(q.field("name"), "Favorites")
        )
      )
      .first();

    if (!favorites) {
      return {};
    }

    // Get all favorite photos for this user
    const favoritePhotos = await ctx.db
      .query("collectionPhotos")
      .withIndex("by_collection", (q) => q.eq("collectionId", favorites._id))
      .collect();

    // Create a Set of favorite photo IDs for quick lookup
    const favoritePhotoIds = new Set(favoritePhotos.map((fp) => fp.photoId));

    // Return a map of photoId -> boolean
    const statusMap: Record<string, boolean> = {};
    for (const photoId of args.photoIds) {
      statusMap[photoId] = favoritePhotoIds.has(photoId);
    }

    return statusMap;
  },
});

// Get all collections that contain a specific photo (for current user)
export const getPhotoCollections = query({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get all collections for this user
    const userCollections = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Check which collections contain this photo
    const collectionsWithPhoto = await Promise.all(
      userCollections.map(async (collection) => {
        const collectionPhoto = await ctx.db
          .query("collectionPhotos")
          .withIndex("by_collection", (q) =>
            q.eq("collectionId", collection._id)
          )
          .filter((q) => q.eq(q.field("photoId"), args.photoId))
          .first();

        return collectionPhoto ? collection : null;
      })
    );

    return collectionsWithPhoto.filter(
      (c): c is NonNullable<typeof c> => c !== null
    );
  },
});

// Toggle photo in/out of Favorites collection
export const toggleFavorites = mutation({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Ensure Favorites collection exists
    let favorites = await ctx.db
      .query("collections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("isDefault"), true),
          q.eq(q.field("name"), "Favorites")
        )
      )
      .first();

    if (!favorites) {
      // Create Favorites collection
      const favoritesId = await ctx.db.insert("collections", {
        userId,
        name: "Favorites",
        description: "Your favorite photos",
        tags: [],
        isPublic: false,
        isDefault: true,
      });
      favorites = await ctx.db.get(favoritesId);
    } else if (!favorites.isDefault) {
      // Update existing to ensure isDefault is set
      await ctx.db.patch(favorites._id, { isDefault: true });
    }

    const favoritesId = favorites!._id;

    // Check if photo is already in Favorites
    const existing = await ctx.db
      .query("collectionPhotos")
      .withIndex("by_collection", (q) => q.eq("collectionId", favoritesId))
      .filter((q) => q.eq(q.field("photoId"), args.photoId))
      .first();

    if (existing) {
      // Remove from Favorites
      await ctx.db.delete(existing._id);
      return { added: false };
    } else {
      // Add to Favorites
      await ctx.db.insert("collectionPhotos", {
        collectionId: favoritesId,
        photoId: args.photoId,
      });
      return { added: true };
    }
  },
});

// Update collection (name, description, tags, isPublic)
export const updateCollection = mutation({
  args: {
    collectionId: v.id("collections"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPublic: v.optional(v.boolean()),
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

    // Prevent renaming to "Favorites" (reserved name) unless it's already the Favorites collection
    const isFavoritesCollection =
      collection.isDefault === true ||
      collection.name.toLowerCase() === "favorites";
    if (
      args.name &&
      args.name.trim().toLowerCase() === "favorites" &&
      !isFavoritesCollection
    ) {
      throw new Error('"Favorites" is a reserved collection name');
    }

    const updates: {
      name?: string;
      description?: string;
      tags?: string[];
      isPublic?: boolean;
    } = {};

    if (args.name !== undefined) {
      updates.name = args.name.trim();
    }
    if (args.description !== undefined) {
      updates.description = args.description.trim() || undefined;
    }
    if (args.tags !== undefined) {
      updates.tags = args.tags;
    }
    if (args.isPublic !== undefined) {
      updates.isPublic = args.isPublic;
    }

    await ctx.db.patch(args.collectionId, updates);
  },
});

// Bulk add photos to collection
export const bulkAddPhotosToCollection = mutation({
  args: {
    collectionId: v.id("collections"),
    photoIds: v.array(v.id("photos")),
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

    let addedCount = 0;
    let skippedCount = 0;

    for (const photoId of args.photoIds) {
      // Check if photo is already in collection
      const existing = await ctx.db
        .query("collectionPhotos")
        .withIndex("by_collection", (q) =>
          q.eq("collectionId", args.collectionId)
        )
        .filter((q) => q.eq(q.field("photoId"), photoId))
        .first();

      if (!existing) {
        await ctx.db.insert("collectionPhotos", {
          collectionId: args.collectionId,
          photoId,
        });
        addedCount++;
      } else {
        skippedCount++;
      }
    }

    return { addedCount, skippedCount };
  },
});

// Create collection and add photos in one operation
export const createCollectionAndAddPhotos = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
    photoIds: v.array(v.id("photos")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Prevent creating a collection named "Favorites" (reserved name)
    if (args.name.trim().toLowerCase() === "favorites") {
      throw new Error('"Favorites" is a reserved collection name');
    }

    // Create the collection
    const collectionId = await ctx.db.insert("collections", {
      userId,
      name: args.name,
      description: args.description,
      tags: [],
      isPublic: args.isPublic,
    });

    // Add photos to collection (skip duplicates)
    let addedCount = 0;
    let skippedCount = 0;

    for (const photoId of args.photoIds) {
      const existing = await ctx.db
        .query("collectionPhotos")
        .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
        .filter((q) => q.eq(q.field("photoId"), photoId))
        .first();

      if (!existing) {
        await ctx.db.insert("collectionPhotos", {
          collectionId,
          photoId,
        });
        addedCount++;
      } else {
        skippedCount++;
      }
    }

    return { collectionId, addedCount, skippedCount };
  },
});
