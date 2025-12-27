import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
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

export type CacheQueryType = "mainFeed" | "editorial" | null;

interface PhotoCacheContextType {
  photos: Map<Id<"photos">, CachedPhoto>;
  getPhoto: (id: Id<"photos">) => CachedPhoto | undefined;
  setPhotos: (photos: CachedPhoto[], queryType?: CacheQueryType) => void;
  updatePhoto: (photo: CachedPhoto) => void;
  // Image blob cache
  getCachedImageUrl: (photoId: Id<"photos">) => string | null;
  preloadImage: (photoId: Id<"photos">, url: string) => void;
  // Cache validity
  isCacheValid: (queryType: CacheQueryType) => boolean;
  invalidateCache: () => void;
  getAllCachedPhotos: () => CachedPhoto[];
}

const PhotoCacheContext = createContext<PhotoCacheContextType | null>(null);

export function PhotoCacheProvider({ children }: { children: ReactNode }) {
  // In-memory only cache - always fetch fresh data on page load/refresh
  // This ensures users always see the latest photos from other users
  const [photos, setPhotosMap] = useState<Map<Id<"photos">, CachedPhoto>>(
    new Map()
  );

  // Track which query type populated the cache
  const [cacheQueryType, setCacheQueryType] = useState<CacheQueryType>(null);

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
    (photosList: CachedPhoto[], queryType?: CacheQueryType) => {
      setPhotosMap((prev) => {
        const newMap = new Map(prev);
        for (const photo of photosList) {
          newMap.set(photo._id, photo);
        }
        return newMap;
      });
      // Track which query type populated the cache
      if (queryType) {
        setCacheQueryType(queryType);
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

  // Check if cache is valid for a specific query type
  const isCacheValid = useCallback(
    (queryType: CacheQueryType) => {
      return cacheQueryType === queryType && photos.size > 0;
    },
    [cacheQueryType, photos.size]
  );

  // Get all cached photos as an array
  const getAllCachedPhotos = useCallback(() => {
    return Array.from(photos.values());
  }, [photos]);

  // Invalidate the cache (force refetch on next render)
  const invalidateCache = useCallback(() => {
    setPhotosMap(new Map());
    setCacheQueryType(null);
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
      }}
    >
      {children}
    </PhotoCacheContext.Provider>
  );
}

export function usePhotoCache() {
  const context = useContext(PhotoCacheContext);
  if (!context) {
    throw new Error("usePhotoCache must be used within a PhotoCacheProvider");
  }
  return context;
}
