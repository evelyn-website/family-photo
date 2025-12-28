import { useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { Id } from "../../convex/_generated/dataModel";
import type {
  CachedPhoto,
  PaginationInfo,
  CacheQueryType,
} from "./PhotoCacheTypes";
import { PhotoCacheContext } from "./PhotoCacheContextInstance";

export function PhotoCacheProvider({ children }: { children: ReactNode }) {
  // In-memory only cache - always fetch fresh data on page load/refresh
  // This ensures users always see the latest photos from other users
  const [photos, setPhotosMap] = useState<Map<Id<"photos">, CachedPhoto>>(
    new Map()
  );

  // Track valid cache keys (supports multiple pages)
  const [validCacheKeys, setValidCacheKeys] = useState<Set<string>>(new Set());

  // Store pagination info per cache key
  const [pageCache, setPageCache] = useState<Map<string, PaginationInfo>>(
    new Map()
  );

  // In-memory cache for image blob URLs (can't persist these to localStorage)
  const imageBlobCache = useRef<Map<Id<"photos">, string>>(new Map());
  // Track which images are currently being fetched
  const pendingFetches = useRef<Set<Id<"photos">>>(new Set());

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    const cache = imageBlobCache.current;
    return () => {
      cache.forEach((blobUrl) => {
        URL.revokeObjectURL(blobUrl);
      });
    };
  }, []);

  const getPhoto = useCallback(
    (id: Id<"photos">) => {
      return photos.get(id);
    },
    [photos]
  );

  const setPhotos = useCallback(
    (
      photosList: CachedPhoto[],
      queryType?: CacheQueryType,
      paginationInfo?: PaginationInfo
    ) => {
      setPhotosMap((prev) => {
        const newMap = new Map(prev);
        for (const photo of photosList) {
          newMap.set(photo._id, photo);
        }
        return newMap;
      });
      // Track which query type populated the cache
      if (queryType) {
        setValidCacheKeys((prev) => new Set(prev).add(queryType));
        // Store pagination info if provided
        if (paginationInfo) {
          setPageCache((prev) => new Map(prev).set(queryType, paginationInfo));
        }
      }
    },
    []
  );

  const updatePhoto = useCallback((photo: CachedPhoto) => {
    setPhotosMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(photo._id, photo);
      return newMap;
    });
  }, []);

  // Get cached blob URL for an image
  const getCachedImageUrl = useCallback((photoId: Id<"photos">) => {
    return imageBlobCache.current.get(photoId) ?? null;
  }, []);

  // Preload and cache an image as a blob URL
  const preloadImage = useCallback((photoId: Id<"photos">, url: string) => {
    // Skip if already cached or currently fetching
    if (
      imageBlobCache.current.has(photoId) ||
      pendingFetches.current.has(photoId)
    ) {
      return;
    }

    pendingFetches.current.add(photoId);

    fetch(url)
      .then((response) => response.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        imageBlobCache.current.set(photoId, blobUrl);
      })
      .catch(() => {
        // Silently fail - will fall back to original URL
      })
      .finally(() => {
        pendingFetches.current.delete(photoId);
      });
  }, []);

  // Check if cache is valid for a specific cache key
  const isCacheValid = useCallback(
    (queryType: CacheQueryType) => {
      if (!queryType) return false;
      return validCacheKeys.has(queryType);
    },
    [validCacheKeys]
  );

  // Get cached page data
  const getCachedPage = useCallback(
    (cacheKey: string): PaginationInfo | null => {
      return pageCache.get(cacheKey) ?? null;
    },
    [pageCache]
  );

  // Get all cached photos as an array
  const getAllCachedPhotos = useCallback(() => {
    return Array.from(photos.values());
  }, [photos]);

  // Invalidate the cache (force refetch on next render)
  const invalidateCache = useCallback(() => {
    setPhotosMap(new Map());
    setValidCacheKeys(new Set());
    setPageCache(new Map());
  }, []);

  return (
    <PhotoCacheContext.Provider
      value={{
        photos,
        getPhoto,
        setPhotos,
        updatePhoto,
        getCachedImageUrl,
        preloadImage,
        isCacheValid,
        invalidateCache,
        getAllCachedPhotos,
        getCachedPage,
      }}
    >
      {children}
    </PhotoCacheContext.Provider>
  );
}
