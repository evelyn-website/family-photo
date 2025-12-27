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
        name: curatorProfile?.displayName || curator?.name || curator?.email || "Anonymous",
      },
    };
  },
});

// Get editorial feed
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

    return Promise.all(
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
            name: profile?.displayName || user?.name || user?.email || "Anonymous",
            email: user?.email,
          },
        };
      })
    ).then(photos => photos.filter(Boolean));
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
