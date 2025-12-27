import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TagFilter } from "./TagFilter";
import { PhotoGrid } from "./PhotoGrid";
import { usePhotoCache } from "../lib/PhotoCacheContext";

interface PhotoFeedProps {
  onUserClick?: (userId: Id<"users">) => void;
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
}

export function PhotoFeed({
  onUserClick,
  selectedTags,
  onAddTag,
  onRemoveTag,
  onClearTags,
}: PhotoFeedProps) {
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
  const allPhotos = shouldSkipFetch ? getAllCachedPhotos() : fetchedPhotos;

  // Populate cache and preload images when photos are loaded from server
  useEffect(() => {
    if (fetchedPhotos && !shouldSkipFetch) {
      // Cast to CachedPhoto since the data structure matches
      setPhotos(fetchedPhotos as any);

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

  // Determine loading state
  const isLoading =
    !allPhotos ||
    (Array.isArray(allPhotos) &&
      allPhotos.length === 0 &&
      fetchedPhotos === undefined);

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
      <TagFilter
        selectedTags={selectedTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onClearTags={onClearTags}
      />
      <PhotoGrid
        photos={allPhotos}
        allPhotos={allPhotos}
        selectedTags={selectedTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onUserClick={onUserClick}
        showEditorialActions={isCurrentCurator}
        isInEditorial={false}
        isLoading={isLoading}
        noPhotosMessage={{
          title: "No photos yet",
          description: "Be the first to share your art!",
        }}
        emptyStateMessage={{
          title: "No photos match your filters",
          description: "Try adjusting your tag filters",
        }}
      />
    </div>
  );
}
