import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // User profiles
  profiles: defineTable({
    userId: v.id("users"),
    bio: v.optional(v.string()),
    displayName: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  // Photos
  photos: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
  }).index("by_user", ["userId"]),

  // Comments on photos
  comments: defineTable({
    photoId: v.id("photos"),
    userId: v.id("users"),
    content: v.string(),
  }).index("by_photo", ["photoId"]),

  // Collections
  collections: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    isPublic: v.boolean(),
  }).index("by_user", ["userId"])
    .index("by_public", ["isPublic"]),

  // Photos in collections
  collectionPhotos: defineTable({
    collectionId: v.id("collections"),
    photoId: v.id("photos"),
  }).index("by_collection", ["collectionId"])
    .index("by_photo", ["photoId"]),

  // Editorial feed management
  editorialPeriods: defineTable({
    curatorId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
  }).index("by_active", ["isActive"])
    .index("by_dates", ["startDate", "endDate"]),

  // Photos in editorial feed
  editorialPhotos: defineTable({
    photoId: v.id("photos"),
    curatorId: v.id("users"),
    periodId: v.id("editorialPeriods"),
  }).index("by_period", ["periodId"])
    .index("by_curator", ["curatorId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
