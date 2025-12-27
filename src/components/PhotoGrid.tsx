import { useState, useEffect, useMemo } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { PhotoCard } from "./PhotoCard";
import { PhotoModal } from "./PhotoModal";
import { CachedPhoto } from "../lib/PhotoCacheContext";

// Photo type that matches what PhotoCard expects
interface Photo {
  _id: Id<"photos">;
  title: string;
  description?: string;
  tags: string[];
  url: string | null;
  userId: Id<"users">;
  user: {
    name: string;
    email?: string;
  };
  _creationTime: number;
}

interface PhotoGridProps {
  // Photos to display (can be undefined for loading state)
  photos?: (Photo | CachedPhoto | null)[];
  // All photos before filtering (for empty state messages)
  allPhotos?: (Photo | CachedPhoto | null)[];
  // Tag filtering (optional - collections may not use this)
  selectedTags?: string[];
  onAddTag?: (tag: string) => void;
  onRemoveTag?: (tag: string) => void;
  // User interaction
  onUserClick?: (userId: Id<"users">) => void;
  // Editorial actions
  showEditorialActions?: boolean;
  isInEditorial?: boolean;
  // Custom empty state messages
  emptyStateMessage?: {
    title?: string;
    description?: string;
  };
  noPhotosMessage?: {
    title?: string;
    description?: string;
  };
  // Loading state
  isLoading?: boolean;
}

export function PhotoGrid({
  photos,
  allPhotos,
  selectedTags = [],
  onAddTag,
  onRemoveTag,
  onUserClick,
  showEditorialActions = false,
  isInEditorial = false,
  emptyStateMessage,
  noPhotosMessage,
  isLoading = false,
}: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<
    Photo | CachedPhoto | null
  >(null);

  // Filter photos based on selected tags (AND logic) - only if tags are provided
  const filteredPhotos = useMemo(() => {
    if (!photos) return undefined;

    // If no tags selected, return all photos
    if (selectedTags.length === 0) {
      return photos.filter((p): p is Photo | CachedPhoto => p !== null);
    }

    // Filter photos that match all selected tags
    return photos
      .filter((p): p is Photo | CachedPhoto => p !== null)
      .filter((photo) =>
        selectedTags.every((tag) =>
          photo.tags.some(
            (photoTag) => photoTag.toLowerCase() === tag.toLowerCase()
          )
        )
      );
  }, [photos, selectedTags]);

  // Sync photo modal with URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const photoIdParam = params.get("photo") as Id<"photos"> | null;

    if (photoIdParam) {
      // Find the photo in the current list
      const photoList = filteredPhotos || [];
      const photo = photoList.find((p) => p._id === photoIdParam);
      if (photo) {
        // Only set if different to avoid unnecessary updates
        if (!selectedPhoto || selectedPhoto._id !== photo._id) {
          setSelectedPhoto(photo);
        }
      } else if (selectedPhoto) {
        // Photo param exists but photo not in list, close modal
        setSelectedPhoto(null);
      }
    } else if (selectedPhoto) {
      // URL was updated to remove photo param, close modal
      setSelectedPhoto(null);
    }
  }, [filteredPhotos, selectedPhoto]);

  // Listen to browser back/forward navigation for photo modal
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const photoIdParam = params.get("photo") as Id<"photos"> | null;

      if (photoIdParam) {
        const photoList = filteredPhotos || [];
        const photo = photoList.find((p) => p._id === photoIdParam);
        if (photo) {
          setSelectedPhoto(photo);
        } else {
          setSelectedPhoto(null);
        }
      } else {
        setSelectedPhoto(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [filteredPhotos]);

  // Helper function to update URL with photo param
  const updateURLWithPhoto = (photoId: Id<"photos"> | null) => {
    const params = new URLSearchParams(window.location.search);

    if (photoId) {
      params.set("photo", photoId);
    } else {
      params.delete("photo");
    }

    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newURL);
  };

  // Handle photo click - store the photo directly
  const handlePhotoClick = (photo: Photo | CachedPhoto) => {
    setSelectedPhoto(photo);
    updateURLWithPhoto(photo._id);
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
    updateURLWithPhoto(null);
  };

  // Show loading state
  if (isLoading || filteredPhotos === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  const photoList = filteredPhotos || [];
  const allPhotosList =
    allPhotos?.filter((p): p is Photo | CachedPhoto => p !== null) || [];

  // Empty states
  if (allPhotosList.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          {noPhotosMessage?.title || "No photos yet"}
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400">
          {noPhotosMessage?.description || "Be the first to share your art!"}
        </p>
      </div>
    );
  }

  if (photoList.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          {emptyStateMessage?.title || "No photos match your filters"}
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400">
          {emptyStateMessage?.description || "Try adjusting your tag filters"}
        </p>
      </div>
    );
  }

  // Render photo grid
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photoList.map((photo) => (
          <PhotoCard
            key={photo._id}
            photo={photo}
            showEditorialActions={showEditorialActions}
            isInEditorial={isInEditorial}
            onClick={() => handlePhotoClick(photo)}
            onUserClick={onUserClick}
            selectedTags={selectedTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
          />
        ))}
      </div>

      {selectedPhoto && (
        <PhotoModal
          photoId={selectedPhoto._id}
          onClose={handleCloseModal}
          showEditorialActions={showEditorialActions}
          isInEditorial={isInEditorial}
          initialPhoto={selectedPhoto as CachedPhoto}
          selectedTags={selectedTags}
        />
      )}
    </>
  );
}
