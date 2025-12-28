import { createContext } from "react";
import { Id } from "../../convex/_generated/dataModel";
import type {
  CachedPhoto,
  PaginationInfo,
  CacheQueryType,
} from "./PhotoCacheTypes";

export interface PhotoCacheContextType {
  photos: Map<Id<"photos">, CachedPhoto>;
  getPhoto: (id: Id<"photos">) => CachedPhoto | undefined;
  setPhotos: (
    photos: CachedPhoto[],
    queryType?: CacheQueryType,
    paginationInfo?: PaginationInfo
  ) => void;
  updatePhoto: (photo: CachedPhoto) => void;
  // Image blob cache
  getCachedImageUrl: (photoId: Id<"photos">) => string | null;
  preloadImage: (photoId: Id<"photos">, url: string) => void;
  // Cache validity
  isCacheValid: (queryType: CacheQueryType) => boolean;
  invalidateCache: () => void;
  getAllCachedPhotos: () => CachedPhoto[];
  // Page-based caching
  getCachedPage: (cacheKey: string) => PaginationInfo | null;
}

export const PhotoCacheContext = createContext<PhotoCacheContextType | null>(
  null
);

