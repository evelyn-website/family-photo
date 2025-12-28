import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get current editorial period
export const getCurrentEditorialPeriod = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const activePeriod = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.lte(q.field("startDate"), now))
      .filter((q) => q.gte(q.field("endDate"), now))
      .unique();

    if (!activePeriod) return null;

    const curator = await ctx.db.get(activePeriod.curatorId);
    const curatorProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", activePeriod.curatorId))
      .unique();

    return {
      ...activePeriod,
      curator: {
        name:
          curatorProfile?.displayName ||
          curator?.name ||
          curator?.email ||
          "Anonymous",
      },
    };
  },
});

// Get editorial feed - legacy, use getPaginatedEditorialFeed instead
export const getEditorialFeed = query({
  args: {},
  handler: async (ctx) => {
    const currentPeriod = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.lte(q.field("startDate"), Date.now()))
      .filter((q) => q.gte(q.field("endDate"), Date.now()))
      .unique();

    if (!currentPeriod) return [];

    const editorialPhotos = await ctx.db
      .query("editorialPhotos")
      .withIndex("by_period", (q) => q.eq("periodId", currentPeriod._id))
      .collect();

    // Sort by _creationTime (order they were added to editorial)
    // Descending = newest added first (most recently added photos appear first)
    editorialPhotos.sort((a, b) => b._creationTime - a._creationTime);

    const photosWithEditorialTime = await Promise.all(
      editorialPhotos.map(async (ep) => {
        const photo = await ctx.db.get(ep.photoId);
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
            email: user?.email,
          },
          // Include when this photo was added to editorial for sorting
          _editorialAddedTime: ep._creationTime,
        };
      })
    );

    // Filter out nulls and sort by when they were added to editorial
    // Sort descending (newest added first) so most recently added photos appear first
    const finalPhotos = photosWithEditorialTime
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b._editorialAddedTime - a._editorialAddedTime);

    return finalPhotos;
  },
});

// Get paginated editorial feed
export const getPaginatedEditorialFeed = query({
  args: {
    page: v.number(),
    pageSize: v.number(),
  },
  handler: async (ctx, args) => {
    const { pageSize } = args;

    const currentPeriod = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.lte(q.field("startDate"), Date.now()))
      .filter((q) => q.gte(q.field("endDate"), Date.now()))
      .unique();

    if (!currentPeriod) {
      return {
        photos: [],
        page: 1,
        pageSize,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      };
    }

    const editorialPhotos = await ctx.db
      .query("editorialPhotos")
      .withIndex("by_period", (q) => q.eq("periodId", currentPeriod._id))
      .collect();

    // Sort by _creationTime (order they were added to editorial)
    // Descending = newest added first
    editorialPhotos.sort((a, b) => b._creationTime - a._creationTime);

    const totalCount = editorialPhotos.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Clamp page to valid range
    const page = Math.max(1, Math.min(args.page, totalPages));
    const offset = (page - 1) * pageSize;

    // Slice for pagination
    const paginatedEditorialPhotos = editorialPhotos.slice(
      offset,
      offset + pageSize
    );

    const photosWithDetails = await Promise.all(
      paginatedEditorialPhotos.map(async (ep) => {
        const photo = await ctx.db.get(ep.photoId);
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
            email: user?.email,
          },
          _editorialAddedTime: ep._creationTime,
        };
      })
    );

    // Filter out nulls
    const finalPhotos = photosWithDetails.filter(
      (p): p is NonNullable<typeof p> => p !== null
    );

    return {
      photos: finalPhotos,
      page,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  },
});

// Get which photos from a list are currently in the editorial feed
export const getPhotosEditorialStatus = query({
  args: { photoIds: v.array(v.id("photos")) },
  handler: async (ctx, args) => {
    if (args.photoIds.length === 0) return [];

    const now = Date.now();
    const currentPeriod = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.lte(q.field("startDate"), now))
      .filter((q) => q.gte(q.field("endDate"), now))
      .unique();

    if (!currentPeriod) return [];

    // Get all editorial photos for the current period
    const editorialPhotos = await ctx.db
      .query("editorialPhotos")
      .withIndex("by_period", (q) => q.eq("periodId", currentPeriod._id))
      .collect();

    // Create a Set of photo IDs that are in editorial
    const editorialPhotoIds = new Set(editorialPhotos.map((ep) => ep.photoId));

    // Return array of photo IDs that are in editorial
    return args.photoIds.filter((photoId) => editorialPhotoIds.has(photoId));
  },
});

// Add photo to editorial feed (only current curator can do this)
export const addToEditorialFeed = mutation({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const currentPeriod = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.lte(q.field("startDate"), now))
      .filter((q) => q.gte(q.field("endDate"), now))
      .unique();

    if (!currentPeriod || currentPeriod.curatorId !== userId) {
      throw new Error("Not authorized to curate editorial feed");
    }

    // Check if photo is already in editorial feed
    const existing = await ctx.db
      .query("editorialPhotos")
      .withIndex("by_period", (q) => q.eq("periodId", currentPeriod._id))
      .filter((q) => q.eq(q.field("photoId"), args.photoId))
      .unique();

    if (existing) {
      throw new Error("Photo already in editorial feed");
    }

    return await ctx.db.insert("editorialPhotos", {
      photoId: args.photoId,
      curatorId: userId,
      periodId: currentPeriod._id,
    });
  },
});

// Remove photo from editorial feed (only current curator can do this)
export const removeFromEditorialFeed = mutation({
  args: { photoId: v.id("photos") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const currentPeriod = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.lte(q.field("startDate"), now))
      .filter((q) => q.gte(q.field("endDate"), now))
      .unique();

    if (!currentPeriod || currentPeriod.curatorId !== userId) {
      throw new Error("Not authorized to curate editorial feed");
    }

    const editorialPhoto = await ctx.db
      .query("editorialPhotos")
      .withIndex("by_period", (q) => q.eq("periodId", currentPeriod._id))
      .filter((q) => q.eq(q.field("photoId"), args.photoId))
      .unique();

    if (editorialPhoto) {
      await ctx.db.delete(editorialPhoto._id);
    }
  },
});

// Bulk remove photos from editorial feed (only current curator can do this)
export const bulkRemovePhotosFromEditorial = mutation({
  args: {
    photoIds: v.array(v.id("photos")),
  },
  returns: v.object({
    removedCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const currentPeriod = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.lte(q.field("startDate"), now))
      .filter((q) => q.gte(q.field("endDate"), now))
      .unique();

    if (!currentPeriod || currentPeriod.curatorId !== userId) {
      throw new Error("Not authorized to curate editorial feed");
    }

    let removedCount = 0;
    let skippedCount = 0;

    for (const photoId of args.photoIds) {
      const editorialPhoto = await ctx.db
        .query("editorialPhotos")
        .withIndex("by_period", (q) => q.eq("periodId", currentPeriod._id))
        .filter((q) => q.eq(q.field("photoId"), photoId))
        .unique();

      if (editorialPhoto) {
        await ctx.db.delete(editorialPhoto._id);
        removedCount++;
      } else {
        skippedCount++;
      }
    }

    return { removedCount, skippedCount };
  },
});

// Bulk add photos to editorial feed (only current curator can do this)
export const bulkAddPhotosToEditorial = mutation({
  args: {
    photoIds: v.array(v.id("photos")),
  },
  returns: v.object({
    addedCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const now = Date.now();
    const currentPeriod = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.lte(q.field("startDate"), now))
      .filter((q) => q.gte(q.field("endDate"), now))
      .unique();

    if (!currentPeriod || currentPeriod.curatorId !== userId) {
      throw new Error("Not authorized to curate editorial feed");
    }

    let addedCount = 0;
    let skippedCount = 0;

    for (const photoId of args.photoIds) {
      // Check if photo is already in editorial feed
      const existing = await ctx.db
        .query("editorialPhotos")
        .withIndex("by_period", (q) => q.eq("periodId", currentPeriod._id))
        .filter((q) => q.eq(q.field("photoId"), photoId))
        .unique();

      if (!existing) {
        await ctx.db.insert("editorialPhotos", {
          photoId,
          curatorId: userId,
          periodId: currentPeriod._id,
        });
        addedCount++;
      } else {
        skippedCount++;
      }
    }

    return { addedCount, skippedCount };
  },
});

// Check if current user is the active curator
export const isCurrentCurator = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const now = Date.now();
    const currentPeriod = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .filter((q) => q.lte(q.field("startDate"), now))
      .filter((q) => q.gte(q.field("endDate"), now))
      .unique();

    return currentPeriod?.curatorId === userId;
  },
});

// List all editorial periods with curator details
export const listAllEditorialPeriods = query({
  args: {},
  handler: async (ctx) => {
    const periods = await ctx.db.query("editorialPeriods").collect();

    const periodsWithCurator = await Promise.all(
      periods.map(async (period) => {
        const curator = await ctx.db.get(period.curatorId);
        const curatorProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", period.curatorId))
          .unique();

        return {
          ...period,
          curator: {
            name:
              curatorProfile?.displayName ||
              curator?.name ||
              curator?.email ||
              "Anonymous",
            email: curator?.email,
          },
        };
      })
    );

    // Sort by start date descending (most recent first)
    return periodsWithCurator.sort((a, b) => b.startDate - a.startDate);
  },
});

// Find user by email
export const findUserByEmail = query({
  args: {
    email: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();
    const users = await ctx.db.query("users").collect();
    const user = users.find(
      (u) => u.email?.toLowerCase().trim() === normalizedEmail
    );

    if (!user) return null;

    return {
      _id: user._id,
      email: user.email,
      name: user.name,
    };
  },
});

// Search users by email prefix (for typeahead)
export const searchUsersByEmail = query({
  args: {
    searchTerm: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const searchTerm = args.searchTerm.toLowerCase().trim();
    const limit = args.limit ?? 10;

    if (searchTerm.length === 0) {
      return [];
    }

    const users = await ctx.db.query("users").collect();
    const matchingUsers = users
      .filter((u) => {
        if (!u.email) return false;
        return u.email.toLowerCase().includes(searchTerm);
      })
      .slice(0, limit)
      .map((user) => ({
        _id: user._id,
        email: user.email,
        name: user.name,
      }));

    return matchingUsers;
  },
});

// Create new editorial period (admin function - you'll need to call this manually)
export const createEditorialPeriod = mutation({
  args: {
    curatorId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Deactivate any existing active periods
    const existingPeriods = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    for (const period of existingPeriods) {
      await ctx.db.patch(period._id, { isActive: false });
    }

    return await ctx.db.insert("editorialPeriods", {
      curatorId: args.curatorId,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: true,
    });
  },
});

// Create editorial period by email (looks up user by email first)
export const createEditorialPeriodByEmail = mutation({
  args: {
    curatorEmail: v.string(),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Find user by email
    const normalizedEmail = args.curatorEmail.toLowerCase().trim();
    const users = await ctx.db.query("users").collect();
    const curator = users.find(
      (u) => u.email?.toLowerCase().trim() === normalizedEmail
    );

    if (!curator) {
      throw new Error("User not found with that email address");
    }

    // Check for overlapping periods
    const allPeriods = await ctx.db.query("editorialPeriods").collect();
    const overlappingPeriod = allPeriods.find((period) => {
      // Two periods overlap if: newStart < existingEnd && newEnd > existingStart
      return args.startDate < period.endDate && args.endDate > period.startDate;
    });

    if (overlappingPeriod) {
      const overlappingStart = new Date(overlappingPeriod.startDate);
      const overlappingEnd = new Date(overlappingPeriod.endDate);
      throw new Error(
        `This period overlaps with an existing period (${overlappingStart.toLocaleDateString()} - ${overlappingEnd.toLocaleDateString()})`
      );
    }

    // Deactivate any existing active periods
    const existingActivePeriods = await ctx.db
      .query("editorialPeriods")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    for (const period of existingActivePeriods) {
      await ctx.db.patch(period._id, { isActive: false });
    }

    return await ctx.db.insert("editorialPeriods", {
      curatorId: curator._id,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: true,
    });
  },
});
