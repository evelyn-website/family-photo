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

interface PhotoCacheContextType {
  photos: Map<Id<"photos">, CachedPhoto>;
  getPhoto: (id: Id<"photos">) => CachedPhoto | undefined;
  setPhotos: (photos: CachedPhoto[]) => void;
  updatePhoto: (photo: CachedPhoto) => void;
  // Image blob cache
  getCachedImageUrl: (photoId: Id<"photos">) => string | null;
  preloadImage: (photoId: Id<"photos">, url: string) => void;
  // Cache validity
  isCacheValid: () => boolean;
  getAllCachedPhotos: () => CachedPhoto[];
}

const PhotoCacheContext = createContext<PhotoCacheContextType | null>(null);

const CACHE_KEY = "family-photo-cache";
const CACHE_EXPIRY_KEY = "family-photo-cache-expiry";
const CACHE_DURATION_MS = 5 * 60 * 1000;

export function PhotoCacheProvider({ children }: { children: ReactNode }) {
  // Track if cache was valid on initial load
  const [cacheValidOnMount] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
      const isValid = !!(expiry && Date.now() < parseInt(expiry, 10));
      return isValid;
    }
    return false;
  });

  const [photos, setPhotosMap] = useState<Map<Id<"photos">, CachedPhoto>>(
    () => {
      // Try to restore from localStorage on initial load
      if (typeof window !== "undefined") {
        try {
          const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
          if (expiry && Date.now() < parseInt(expiry, 10)) {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
              const parsed = JSON.parse(cached) as [
                Id<"photos">,
                CachedPhoto,
              ][];
              return new Map(parsed);
            }
          }
        } catch (e) {
          console.warn("Failed to restore photo cache:", e);
        }
      }
      return new Map();
    }
  );

  // In-memory cache for image blob URLs (can't persist these to localStorage)
  const imageBlobCache = useRef<Map<Id<"photos">, string>>(new Map());
  // Track which images are currently being fetched
  const pendingFetches = useRef<Set<Id<"photos">>>(new Set());

  // Persist to localStorage when photos change
  useEffect(() => {
    if (photos.size > 0) {
      try {
        const entries = Array.from(photos.entries());
        localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
        localStorage.setItem(
          CACHE_EXPIRY_KEY,
          String(Date.now() + CACHE_DURATION_MS)
        );
      } catch (e) {
        console.warn("Failed to persist photo cache:", e);
      }
    }
  }, [photos]);

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

  const setPhotos = useCallback((photosList: CachedPhoto[]) => {
    setPhotosMap((prev) => {
      const newMap = new Map(prev);
      for (const photo of photosList) {
        newMap.set(photo._id, photo);
      }
      return newMap;
    });
  }, []);

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

  // Check if cache is still valid (hasn't expired)
  const isCacheValid = useCallback(() => {
    return cacheValidOnMount && photos.size > 0;
  }, [cacheValidOnMount, photos.size]);

  // Get all cached photos as an array
  const getAllCachedPhotos = useCallback(() => {
    return Array.from(photos.values());
  }, [photos]);

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
