import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { query } from "./_generated/server";
import { v } from "convex/values";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password],
});

export const loggedInUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      image: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      phoneVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});

// Check if the current user is admin
export const isAdmin = query({
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

// Helper function to check if email is allowed (for use in other functions)
export const isEmailAllowed = async (
  ctx: any,
  email: string
): Promise<boolean> => {
  const normalizedEmail = email.toLowerCase().trim();
  const allowed = await ctx.db
    .query("allowedEmails")
    .withIndex("by_email", (q: any) => q.eq("email", normalizedEmail))
    .unique();
  return allowed !== null;
};

// Helper function to require admin (throws error if not admin)
export const requireAdmin = async (ctx: any, userId: any): Promise<void> => {
  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();

  if (!profile || profile.isAdmin !== true) {
    throw new Error("Admin access required");
  }
};
