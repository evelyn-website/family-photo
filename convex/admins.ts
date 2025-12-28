import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./auth";
import { Id } from "./_generated/dataModel";

// Admin email that automatically becomes admin on sign-up
const ADMIN_EMAILS = ["evelynnelson000@gmail.com"];

// Check if an email should automatically become admin
export const shouldBeAdmin = (email: string | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

// Set admin status for a user (called after user creation)
export const setAdminOnSignup = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.email) return null;

    // Check if email should be admin
    if (shouldBeAdmin(args.email)) {
      // Get or create profile
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .unique();

      if (profile) {
        // Update existing profile
        await ctx.db.patch(profile._id, { isAdmin: true });
      } else {
        // Create new profile with admin flag
        await ctx.db.insert("profiles", {
          userId: args.userId,
          isAdmin: true,
        });
      }
    }

    return null;
  },
});

// Get current user's admin status
export const getCurrentUserIsAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return false;
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return profile?.isAdmin === true;
  },
});

// Add admin status to a user (admin only)
export const addAdmin = mutation({
  args: {
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check if current user is admin
    await requireAdmin(ctx, currentUserId);

    // Must provide either userId or email
    if (!args.userId && !args.email) {
      throw new Error("Must provide either userId or email");
    }

    let targetUserId: Id<"users"> | null = null;

    if (args.userId) {
      targetUserId = args.userId;
    } else if (args.email) {
      // Find user by email
      const normalizedEmail = args.email.toLowerCase().trim();
      const users = await ctx.db.query("users").collect();
      const user = users.find(
        (u) => u.email?.toLowerCase().trim() === normalizedEmail
      );
      if (!user) {
        throw new Error("User not found with that email");
      }
      targetUserId = user._id;
    }

    if (!targetUserId) {
      throw new Error("Could not find user");
    }

    // Prevent adding yourself (redundant but safe)
    if (targetUserId === currentUserId) {
      throw new Error("You are already an admin");
    }

    // Get or create profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", targetUserId))
      .unique();

    if (profile) {
      // Update existing profile
      await ctx.db.patch(profile._id, { isAdmin: true });
    } else {
      // Create new profile with admin flag
      await ctx.db.insert("profiles", {
        userId: targetUserId,
        isAdmin: true,
      });
    }

    return null;
  },
});

// Remove admin status from a user (admin only, cannot remove own admin status)
export const removeAdmin = mutation({
  args: {
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) {
      throw new Error("Not authenticated");
    }

    // Check if current user is admin
    await requireAdmin(ctx, currentUserId);

    // Prevent removing own admin status
    if (args.userId === currentUserId) {
      throw new Error("You cannot remove your own admin status");
    }

    // Get profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Remove admin status
    await ctx.db.patch(profile._id, { isAdmin: false });

    return null;
  },
});

// List all admin users (admin only)
export const listAdmins = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      _creationTime: v.number(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    await requireAdmin(ctx, userId);

    // Get all admin profiles
    const adminProfiles = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("isAdmin"), true))
      .collect();

    // Get user details for each admin
    const admins = [];
    for (const profile of adminProfiles) {
      const user = await ctx.db.get(profile.userId);
      if (user) {
        admins.push({
          _id: user._id,
          email: user.email,
          name: user.name,
          _creationTime: user._creationTime,
        });
      }
    }

    return admins.sort((a, b) => b._creationTime - a._creationTime);
  },
});
