import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin, isEmailAllowed } from "./auth";

// Add email to allowlist (admin only)
export const addEmail = mutation({
  args: {
    email: v.string(),
  },
  returns: v.id("allowedEmails"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    await requireAdmin(ctx, userId);

    // Normalize email
    const normalizedEmail = args.email.toLowerCase().trim();

    // Check if email already exists
    const existing = await ctx.db
      .query("allowedEmails")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (existing) {
      throw new Error("Email is already in the allowlist");
    }

    // Add email to allowlist
    return await ctx.db.insert("allowedEmails", {
      email: normalizedEmail,
      addedBy: userId,
      addedAt: Date.now(),
    });
  },
});

// Remove email from allowlist (admin only, cannot remove own email)
export const removeEmail = mutation({
  args: {
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    await requireAdmin(ctx, userId);

    // Get current user to check their email
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Normalize email
    const normalizedEmail = args.email.toLowerCase().trim();

    // Prevent removing own email
    if (user.email?.toLowerCase().trim() === normalizedEmail) {
      throw new Error("You cannot remove your own email from the allowlist");
    }

    // Find and remove email
    const allowed = await ctx.db
      .query("allowedEmails")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();

    if (!allowed) {
      throw new Error("Email not found in allowlist");
    }

    await ctx.db.delete(allowed._id);
    return null;
  },
});

// List all allowed emails (admin only)
export const listAllowedEmails = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("allowedEmails"),
      _creationTime: v.number(),
      email: v.string(),
      addedBy: v.id("users"),
      addedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    await requireAdmin(ctx, userId);

    // Return all allowed emails
    const emails = await ctx.db.query("allowedEmails").collect();
    return emails.sort((a, b) => b.addedAt - a.addedAt);
  },
});

// Check if specific email is allowed (public, for sign-up validation)
export const checkEmailAllowed = query({
  args: {
    email: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await isEmailAllowed(ctx, args.email);
  },
});

// Check if specific email is allowed (mutation version for client-side validation)
export const checkEmailAllowedMutation = mutation({
  args: {
    email: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    return await isEmailAllowed(ctx, args.email);
  },
});
