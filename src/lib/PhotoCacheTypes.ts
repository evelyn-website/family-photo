import { Id } from "../../convex/_generated/dataModel";

// Photo type matching what getChronologicalFeed returns
export interface CachedPhoto {
  _id: Id<"photos">;
  _creationTime: number;
  userId: Id<"users">;
  // Legacy field for backward compatibility
  storageId?: Id<"_storage">;
  // New multi-version fields
  thumbnailStorageId?: Id<"_storage">;
  mediumStorageId?: Id<"_storage">;
  originalStorageId?: Id<"_storage">;
  title: string;
  description?: string;
  tags: string[];
  isNSFW?: boolean;
  // Multi-version URLs
  thumbnailUrl?: string | null;
  mediumUrl?: string | null;
  url: string | null;
  commentCount?: number;
  user: {
    name: string;
    email?: string;
  };
}

// Pagination info returned from paginated queries
export interface PaginationInfo {
  photos: CachedPhoto[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Cache key can be a simple type or a page-specific key
export type CacheQueryType = string | null;
