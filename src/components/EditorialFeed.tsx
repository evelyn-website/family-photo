import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PhotoCard } from "./PhotoCard";
import { PhotoModal } from "./PhotoModal";
import { CachedPhoto, usePhotoCache } from "../lib/PhotoCacheContext";

export function EditorialFeed() {
  const [selectedPhoto, setSelectedPhoto] = useState<CachedPhoto | null>(null);
  const photos = useQuery(api.editorial.getEditorialFeed);
  const currentPeriod = useQuery(api.editorial.getCurrentEditorialPeriod);
  const isCurrentCurator = useQuery(api.editorial.isCurrentCurator);
  const { setPhotos, preloadImage } = usePhotoCache();

  // Populate cache and preload images when photos are loaded
  useEffect(() => {
    if (photos) {
      // Filter out null values and cast to CachedPhoto
      const validPhotos = photos.filter(
        (p): p is NonNullable<typeof p> => p !== null
      );
      setPhotos(validPhotos as CachedPhoto[]);

      // Preload all visible images into blob cache
      for (const photo of validPhotos) {
        if (photo.url) {
          preloadImage(photo._id as Id<"photos">, photo.url);
        }
      }
    }
  }, [photos, setPhotos, preloadImage]);

  // Handle photo click - store the photo directly
  const handlePhotoClick = (photo: CachedPhoto) => {
    setSelectedPhoto(photo);
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
  };

  if (photos === undefined || currentPeriod === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (!currentPeriod) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          No active editorial period
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400">
          Check back later for curated content!
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          Editorial Feed
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Curated by{" "}
          <span className="font-medium">{currentPeriod.curator.name}</span>
          {isCurrentCurator && (
            <span className="ml-2 px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs rounded-full">
              You're the curator
            </span>
          )}
        </p>
        {isCurrentCurator && (
          <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
            Browse the main feed to add photos to your editorial selection
          </p>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            No photos selected yet
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400">
            {isCurrentCurator
              ? "Start curating by adding photos from the main feed!"
              : "The curator hasn't selected any photos yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map(
            (photo) =>
              photo && (
                <PhotoCard
                  key={photo._id}
                  photo={photo}
                  showEditorialActions={isCurrentCurator}
                  isInEditorial={true}
                  onClick={() => handlePhotoClick(photo as CachedPhoto)}
                />
              )
          )}
        </div>
      )}

      {selectedPhoto && (
        <PhotoModal
          photoId={selectedPhoto._id}
          onClose={handleCloseModal}
          showEditorialActions={isCurrentCurator}
          isInEditorial={true}
          initialPhoto={selectedPhoto}
        />
      )}
    </div>
  );
}
