import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PhotoCard } from "./PhotoCard";
import { PhotoModal } from "./PhotoModal";
import { BulkActionMenu } from "./BulkActionMenu";
import { BulkAddToCollectionDialog } from "./BulkAddToCollectionDialog";
import { CachedPhoto } from "../lib/PhotoCacheContext";
import { toast } from "sonner";

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
  // Favorites button (show in normal feeds, not editorial)
  showFavoritesButton?: boolean;
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
  showFavoritesButton = true,
  emptyStateMessage,
  noPhotosMessage,
  isLoading = false,
}: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<
    Photo | CachedPhoto | null
  >(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<Id<"photos">>>(
    new Set()
  );
  const [showBulkAddDialog, setShowBulkAddDialog] = useState(false);

  // Get favorite status for all photos
  const photoIds = useMemo(() => {
    if (!photos) return [];
    return photos
      .filter((p): p is Photo | CachedPhoto => p !== null)
      .map((p) => p._id);
  }, [photos]);

  const favoriteStatus = useQuery(
    api.collections.getPhotosFavoriteStatus,
    photoIds.length > 0 && showFavoritesButton ? { photoIds } : "skip"
  );

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

  // Handle photo click - store the photo directly (only when not in selection mode)
  const handlePhotoClick = (photo: Photo | CachedPhoto) => {
    if (!isSelectionMode) {
      setSelectedPhoto(photo);
      updateURLWithPhoto(photo._id);
    }
  };

  const handleCloseModal = () => {
    setSelectedPhoto(null);
    updateURLWithPhoto(null);
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      // Exiting selection mode, clear selections
      setSelectedPhotoIds(new Set());
    }
  };

  const handleTogglePhotoSelect = (photoId: Id<"photos">) => {
    const newSet = new Set(selectedPhotoIds);
    if (newSet.has(photoId)) {
      newSet.delete(photoId);
    } else {
      newSet.add(photoId);
    }
    setSelectedPhotoIds(newSet);
  };

  const handleAddToCollection = () => {
    setShowBulkAddDialog(true);
  };

  const handleCloseBulkAddDialog = () => {
    setShowBulkAddDialog(false);
    // Clear selection after successful add
    setSelectedPhotoIds(new Set());
    setIsSelectionMode(false);
  };

  const handleCopyLinks = (photoIds: Id<"photos">[]) => {
    void (async () => {
      try {
        // Generate full URLs for each photo
        const urls = photoIds.map(
          (photoId) => `${window.location.origin}?view=feed&photo=${photoId}`
        );

        // Join with line breaks
        const linksText = urls.join("\n");

        // Copy to clipboard
        await navigator.clipboard.writeText(linksText);

        // Show success toast
        toast.success(
          `Copied ${photoIds.length} link${photoIds.length === 1 ? "" : "s"} to clipboard`
        );
      } catch (error) {
        console.error("Failed to copy links:", error);
        toast.error("Failed to copy links to clipboard");
      }
    })();
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

  const hasAnySelection = selectedPhotoIds.size > 0;

  // Render photo grid
  return (
    <>
      <div className="relative">
        {/* Selection mode toggle button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleToggleSelectionMode}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isSelectionMode
                ? "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 hover:bg-rose-200 dark:hover:bg-rose-900/70"
                : "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70"
            }`}
          >
            {isSelectionMode ? "Cancel Selection" : "Select Photos"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photoList.map((photo) => (
            <PhotoCard
              key={photo._id}
              photo={photo}
              showEditorialActions={showEditorialActions}
              isInEditorial={isInEditorial}
              onClick={
                isSelectionMode ? undefined : () => handlePhotoClick(photo)
              }
              onUserClick={onUserClick}
              selectedTags={selectedTags}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              showFavoritesButton={showFavoritesButton}
              isInFavorites={favoriteStatus?.[photo._id] ?? false}
              isSelectionMode={isSelectionMode}
              isSelected={selectedPhotoIds.has(photo._id)}
              onToggleSelect={() => handleTogglePhotoSelect(photo._id)}
              hasAnySelection={hasAnySelection}
            />
          ))}
        </div>
      </div>

      {selectedPhoto && !isSelectionMode && (
        <PhotoModal
          photoId={selectedPhoto._id}
          onClose={handleCloseModal}
          showEditorialActions={showEditorialActions}
          isInEditorial={isInEditorial}
          initialPhoto={selectedPhoto as CachedPhoto}
          selectedTags={selectedTags}
        />
      )}

      {isSelectionMode && (
        <BulkActionMenu
          selectedCount={selectedPhotoIds.size}
          selectedPhotoIds={Array.from(selectedPhotoIds)}
          onAddToCollection={handleAddToCollection}
          onCopyLinks={handleCopyLinks}
        />
      )}

      {showBulkAddDialog && (
        <BulkAddToCollectionDialog
          photoIds={Array.from(selectedPhotoIds)}
          onClose={handleCloseBulkAddDialog}
        />
      )}
    </>
  );
}
