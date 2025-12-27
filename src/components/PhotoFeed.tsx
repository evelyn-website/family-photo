import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PhotoCard } from "./PhotoCard";
import { PhotoModal } from "./PhotoModal";
import { CachedPhoto, usePhotoCache } from "../lib/PhotoCacheContext";

export function PhotoFeed() {
  const [selectedPhoto, setSelectedPhoto] = useState<CachedPhoto | null>(null);
  const { setPhotos, preloadImage, isCacheValid, getAllCachedPhotos } =
    usePhotoCache();

  // Check if we have valid cached data - if so, skip the Convex query
  const shouldSkipFetch = isCacheValid();

  // Only fetch from Convex if cache is not valid
  const fetchedPhotos = useQuery(
    api.photos.getChronologicalFeed,
    shouldSkipFetch ? "skip" : {}
  );
  const isCurrentCurator = useQuery(api.editorial.isCurrentCurator);

  // Use cached photos if available, otherwise use fetched
  const photos = shouldSkipFetch ? getAllCachedPhotos() : fetchedPhotos;

  // Populate cache and preload images when photos are loaded from server
  useEffect(() => {
    if (fetchedPhotos && !shouldSkipFetch) {
      // Cast to CachedPhoto since the data structure matches
      setPhotos(fetchedPhotos as CachedPhoto[]);

      // Preload all visible images into blob cache
      for (const photo of fetchedPhotos) {
        if (photo.url) {
          preloadImage(photo._id as Id<"photos">, photo.url);
        }
      }
    }
  }, [fetchedPhotos, shouldSkipFetch, setPhotos, preloadImage]);

  // Also preload images when using cached data (blob cache doesn't persist across refreshes)
  const cachedPhotos = getAllCachedPhotos();
  useEffect(() => {
    if (shouldSkipFetch && cachedPhotos.length > 0) {
      for (const photo of cachedPhotos) {
        if (photo.url) {
          preloadImage(photo._id, photo.url);
        }
      }
    }
  }, [shouldSkipFetch, cachedPhotos, preloadImage]);

  // Handle photo click - store the photo directly, not just the ID
  const handlePhotoClick = (photo: CachedPhoto) => {
    setSelectedPhoto(photo);
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
  };

  // Show loading only if we don't have cached data and are still fetching
  if (
    !photos ||
    (Array.isArray(photos) &&
      photos.length === 0 &&
      fetchedPhotos === undefined)
  ) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  const photoList = Array.isArray(photos) ? photos : [];

  if (photoList.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          No photos yet
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400">
          Be the first to share your art!
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        All Photos
      </h2>
      {isCurrentCurator && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-md">
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            <strong>You're the current curator!</strong> Click "Add to
            Editorial" on photos to feature them.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photoList.map((photo) => (
          <PhotoCard
            key={photo._id}
            photo={photo}
            showEditorialActions={isCurrentCurator}
            isInEditorial={false}
            onClick={() => handlePhotoClick(photo)}
          />
        ))}
      </div>

      {selectedPhoto && (
        <PhotoModal
          photoId={selectedPhoto._id}
          onClose={handleCloseModal}
          showEditorialActions={isCurrentCurator}
          isInEditorial={false}
          initialPhoto={selectedPhoto}
        />
      )}
    </div>
  );
}
