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
  // Now supports multiple versions: thumbnail, medium
  const imageBlobCache = useRef<
    Map<Id<"photos">, { thumbnail?: string; medium?: string }>
  >(new Map());
  // Track which images are currently being fetched
  const pendingFetches = useRef<Set<string>>(new Set());

  // During dev HMR, React can preserve provider state across code updates.
  // Clear all cached photo/page data on mount so old URL shapes do not linger.
  useEffect(() => {
    setPhotosMap(new Map());
    setValidCacheKeys(new Set());
    setPageCache(new Map());
  }, []);

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    const cache = imageBlobCache.current;
    return () => {
      cache.forEach((versions) => {
        if (versions.thumbnail) URL.revokeObjectURL(versions.thumbnail);
        if (versions.medium) URL.revokeObjectURL(versions.medium);
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
    // Update the main photos Map
    setPhotosMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(photo._id, photo);
      return newMap;
    });
    
    // Also update pageCache entries that contain this photo
    setPageCache((prev) => {
      const newPageCache = new Map(prev);
      let updated = false;
      
      for (const [cacheKey, paginationInfo] of newPageCache.entries()) {
        const photoIndex = paginationInfo.photos.findIndex(
          (p) => p._id === photo._id
        );
        if (photoIndex !== -1) {
          // Update the photo in this page's array
          const updatedPhotos = [...paginationInfo.photos];
          updatedPhotos[photoIndex] = photo;
          newPageCache.set(cacheKey, {
            ...paginationInfo,
            photos: updatedPhotos,
          });
          updated = true;
        }
      }
      
      // Only return new Map if we made changes (for React optimization)
      return updated ? newPageCache : prev;
    });
  }, []);

  // Get cached blob URL for an image (defaults to thumbnail for backward compatibility)
  const getCachedImageUrl = useCallback(
    (photoId: Id<"photos">, version: "thumbnail" | "medium" = "thumbnail") => {
      const cached = imageBlobCache.current.get(photoId);
      return cached?.[version] ?? null;
    },
    []
  );

  // Preload and cache an image as a blob URL
  const preloadImage = useCallback(
    (
      photoId: Id<"photos">,
      url: string,
      version: "thumbnail" | "medium" = "thumbnail"
    ) => {
      const cacheKey = `${photoId}-${version}`;

      // Skip if already cached or currently fetching
      const cached = imageBlobCache.current.get(photoId);
      if (cached?.[version] || pendingFetches.current.has(cacheKey)) {
        return;
      }

      pendingFetches.current.add(cacheKey);

      fetch(url)
        .then((response) => response.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          const existing = imageBlobCache.current.get(photoId) || {};
          imageBlobCache.current.set(photoId, {
            ...existing,
            [version]: blobUrl,
          });
        })
        .catch(() => {
          // Silently fail - will fall back to original URL
        })
        .finally(() => {
          pendingFetches.current.delete(cacheKey);
        });
    },
    []
  );

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

  // Invalidate a specific cache key (useful for invalidating a single page)
  const invalidateCacheKey = useCallback((cacheKey: string) => {
    setValidCacheKeys((prev) => {
      const newSet = new Set(prev);
      newSet.delete(cacheKey);
      return newSet;
    });
    setPageCache((prev) => {
      const newMap = new Map(prev);
      newMap.delete(cacheKey);
      return newMap;
    });
  }, []);

  return (
    <PhotoCacheContext.Provider
      value={{
        photos,
        pageCache,
        getPhoto,
        setPhotos,
        updatePhoto,
        getCachedImageUrl,
        preloadImage,
        isCacheValid,
        invalidateCache,
        invalidateCacheKey,
        getAllCachedPhotos,
        getCachedPage,
      }}
    >
      {children}
    </PhotoCacheContext.Provider>
  );
}
