import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { isEmailAllowed } from "./auth";
import { internal } from "./_generated/api";

// Validate user after sign-up and set admin status if needed
// This should be called after successful sign-up
export const validateUserAfterSignup = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if email is allowed
    if (!user.email) {
      throw new Error("User email not found");
    }

    const emailAllowed = await isEmailAllowed(ctx, user.email);
    if (!emailAllowed) {
      // Delete user if not allowed
      await ctx.db.delete(userId);
      throw new Error(
        "Your email is not on the allowlist. Please contact an administrator."
      );
    }

    // Set admin status if email matches admin list
    await ctx.scheduler.runAfter(0, internal.admins.setAdminOnSignup, {
      userId,
      email: user.email,
    });

    return null;
  },
});
