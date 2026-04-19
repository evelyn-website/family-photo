import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // User profiles
  profiles: defineTable({
    userId: v.id("users"),
    bio: v.optional(v.string()),
    displayName: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  // Allowed email addresses for invite-only access
  allowedEmails: defineTable({
    email: v.string(),
    addedBy: v.id("users"),
    addedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_added_by", ["addedBy"]),

  // Photos
  photos: defineTable({
    userId: v.id("users"),
    // Legacy field for backward compatibility
    storageId: v.optional(v.id("_storage")),
    // Multi-resolution fields
    thumbnailStorageId: v.optional(v.id("_storage")), // ~800px - grid view
    mediumStorageId: v.optional(v.id("_storage")),    // ~2400px - modal view
    originalStorageId: v.optional(v.id("_storage")),  // True original, untouched, for download
    title: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isNSFW: v.optional(v.boolean()),
    isEncrypted: v.optional(v.boolean()),
    encryptionVersion: v.optional(v.number()),
    thumbnailContentType: v.optional(v.string()),
    mediumContentType: v.optional(v.string()),
    originalContentType: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  appSettings: defineTable({
    key: v.string(),
    booleanValue: v.optional(v.boolean()),
    stringValue: v.optional(v.string()),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_key", ["key"]),

  // Comments on photos
  comments: defineTable({
    photoId: v.id("photos"),
    userId: v.optional(v.id("users")),
    content: v.string(),
  }).index("by_photo", ["photoId"]),

  // Collections
  collections: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPublic: v.boolean(),
    isDefault: v.optional(v.boolean()),
  })
    .index("by_user", ["userId"])
    .index("by_public", ["isPublic"]),

  // Photos in collections
  collectionPhotos: defineTable({
    collectionId: v.id("collections"),
    photoId: v.id("photos"),
  })
    .index("by_collection", ["collectionId"])
    .index("by_photo", ["photoId"]),

  // Editorial feed management
  editorialPeriods: defineTable({
    curatorId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
  })
    .index("by_active", ["isActive"])
    .index("by_dates", ["startDate", "endDate"]),

  // Photos in editorial feed
  editorialPhotos: defineTable({
    photoId: v.id("photos"),
    curatorId: v.id("users"),
    periodId: v.id("editorialPeriods"),
  })
    .index("by_period", ["periodId"])
    .index("by_curator", ["curatorId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
