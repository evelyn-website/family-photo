import { Id } from "../../convex/_generated/dataModel";

// Photo type matching what getChronologicalFeed returns
export interface CachedPhoto {
  _id: Id<"photos">;
  _creationTime: number;
  userId: Id<"users">;
  storageId: Id<"_storage">;
  title: string;
  description?: string;
  tags: string[];
  url: string | null;
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

