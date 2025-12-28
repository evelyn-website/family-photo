import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PhotoGrid } from "./PhotoGrid";
import { TagFilter } from "./TagFilter";
import { toast } from "sonner";
import { usePhotoCache } from "../lib/usePhotoCache";

const PAGE_SIZE = 24;

interface CollectionViewProps {
  collectionId: Id<"collections">;
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
  onUserClick?: (userId: Id<"users">) => void;
}

export function CollectionView({
  collectionId,
  selectedTags,
  onAddTag,
  onRemoveTag,
  onClearTags,
  onUserClick,
}: CollectionViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);

  const { preloadImage } = usePhotoCache();

  // Get current page from URL
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const pageParam = params.get("page");
    const parsed = pageParam ? parseInt(pageParam, 10) : 1;
    return isNaN(parsed) ? 1 : Math.max(1, parsed);
  });

  // Update URL when page changes
  const updatePageInURL = useCallback((page: number) => {
    const params = new URLSearchParams(window.location.search);
    if (page === 1) {
      params.delete("page");
    } else {
      params.set("page", page.toString());
    }
    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newURL);
  }, []);

  // Listen to browser back/forward for page changes
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get("page");
      const parsed = pageParam ? parseInt(pageParam, 10) : 1;
      setCurrentPage(isNaN(parsed) ? 1 : Math.max(1, parsed));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Reset page when collectionId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [collectionId]);

  // Always fetch the paginated collection - don't skip for collections since we need the collection metadata
  const paginatedCollection = useQuery(api.collections.getPaginatedCollection, {
    collectionId,
    page: currentPage,
    pageSize: PAGE_SIZE,
  });

  const currentUser = useQuery(api.auth.loggedInUser);
  const isCurrentCurator = useQuery(api.editorial.isCurrentCurator);
  const updateCollection = useMutation(api.collections.updateCollection);

  // Use fetched data
  const collection = paginatedCollection?.collection ?? null;
  const rawPhotosFromQuery = paginatedCollection?.photos;
  const paginationInfo = paginatedCollection;

  // Check if current user owns this collection
  const isOwner =
    currentUser && collection && currentUser._id === collection.userId;

  // Sync page state with server response if page was clamped
  useEffect(() => {
    if (paginatedCollection && paginatedCollection.page !== currentPage) {
      setCurrentPage(paginatedCollection.page);
      updatePageInURL(paginatedCollection.page);
    }
  }, [paginatedCollection, currentPage, updatePageInURL]);

  // Transform collection photos to match PhotoGrid expected format
  const rawPhotos = useMemo(() => {
    if (!rawPhotosFromQuery) return [];
    return rawPhotosFromQuery
      .filter((photo): photo is NonNullable<typeof photo> => photo !== null)
      .map((photo) => ({
        ...photo,
        tags: photo.tags ?? [],
        user: {
          name: photo.user.name,
        },
      }));
  }, [rawPhotosFromQuery]);

  // Get photo IDs for editorial status query
  const photoIds = useMemo(() => {
    return rawPhotos.map((photo) => photo._id);
  }, [rawPhotos]);

  // Query which photos are in editorial
  const editorialPhotoIds = useQuery(
    api.editorial.getPhotosEditorialStatus,
    photoIds.length > 0 ? { photoIds } : "skip"
  );

  // Create a Set for quick lookup
  const editorialSet = useMemo(() => {
    if (!editorialPhotoIds) return new Set<Id<"photos">>();
    return new Set(editorialPhotoIds);
  }, [editorialPhotoIds]);

  // Enrich photos with isInEditorial property
  const photos = useMemo(() => {
    return rawPhotos.map((photo) => ({
      ...photo,
      isInEditorial: editorialSet.has(photo._id),
    }));
  }, [rawPhotos, editorialSet]);

  // Preload images when photos are loaded
  useEffect(() => {
    if (paginatedCollection?.photos) {
      for (const photo of paginatedCollection.photos) {
        if (photo && photo.url) {
          preloadImage(photo._id as Id<"photos">, photo.url);
        }
      }
    }
  }, [paginatedCollection, preloadImage]);

  // Page navigation handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePageInURL(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isPhotosLoading = paginatedCollection === undefined;

  // Update form when collection changes or editing starts
  useEffect(() => {
    if (collection) {
      setEditName(collection.name);
      setEditDescription(collection.description || "");
      setEditTags((collection.tags || []).join(", "));
      setEditIsPublic(collection.isPublic);
    }
  }, [collection, isEditing]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editName.trim()) {
      toast.error("Please provide a collection name");
      return;
    }

    try {
      const tagArray = editTags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);

      await updateCollection({
        collectionId,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        tags: tagArray,
        isPublic: editIsPublic,
      });

      setIsEditing(false);
      toast.success("Collection updated successfully!");
    } catch (error: any) {
      console.error("Failed to update collection:", error);
      toast.error(error.message || "Failed to update collection");
    }
  };

  if (paginatedCollection === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (paginatedCollection === null || !collection) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          Collection not found
        </h3>
        <p className="text-zinc-600 dark:text-zinc-400">
          This collection doesn't exist or you don't have permission to view it.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        {isEditing && isOwner ? (
          <form onSubmit={(e) => void handleSaveEdit(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                placeholder="Collection name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Description
              </label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                placeholder="Describe your collection (optional)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Tags
              </label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                placeholder="tag1, tag2, tag3 (separate with commas)"
              />
              <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
                Separate tags with commas
              </p>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="editIsPublic"
                checked={editIsPublic}
                onChange={(e) => setEditIsPublic(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
              />
              <label
                htmlFor="editIsPublic"
                className="ml-2 text-sm text-zinc-700 dark:text-zinc-300"
              >
                Make this collection public
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  // Reset form to original values
                  if (collection) {
                    setEditName(collection.name);
                    setEditDescription(collection.description || "");
                    setEditTags((collection.tags || []).join(", "));
                    setEditIsPublic(collection.isPublic);
                  }
                }}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                  {collection.name}
                </h2>
                {collection.description && (
                  <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                    {collection.description}
                  </p>
                )}
                {collection.tags && collection.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {collection.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="flex-shrink-0 px-2 py-1 text-xs rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {isOwner && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="ml-4 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Edit Collection
                </button>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-500">
              <span>
                by{" "}
                {onUserClick && collection.userId ? (
                  <button
                    onClick={() => onUserClick(collection.userId)}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline transition-colors"
                  >
                    {collection.owner.name}
                  </button>
                ) : (
                  collection.owner.name
                )}
              </span>
              <span>{paginationInfo?.totalCount ?? 0} photos</span>
              <span
                className={`px-2 py-1 rounded-full text-xs ${
                  collection.isPublic
                    ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                }`}
              >
                {collection.isPublic ? "Public" : "Private"}
              </span>
            </div>
          </>
        )}
      </div>

      <TagFilter
        selectedTags={selectedTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onClearTags={onClearTags}
      />

      <PhotoGrid
        photos={photos}
        allPhotos={photos}
        selectedTags={selectedTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onUserClick={onUserClick}
        showEditorialActions={isCurrentCurator}
        showFavoritesButton={true}
        isLoading={isPhotosLoading}
        noPhotosMessage={{
          title: "No photos in this collection",
          description: "Add photos to this collection to see them here",
        }}
        emptyStateMessage={{
          title: "No photos match your filters",
          description: "Try adjusting your tag filters",
        }}
      />

      {/* Pagination Controls */}
      {paginationInfo && paginationInfo.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!paginationInfo.hasPrevPage}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {(() => {
              const pages: (number | "ellipsis")[] = [];
              const totalPages = paginationInfo.totalPages;

              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (currentPage > 3) pages.push("ellipsis");
                const start = Math.max(2, currentPage - 1);
                const end = Math.min(totalPages - 1, currentPage + 1);
                for (let i = start; i <= end; i++) pages.push(i);
                if (currentPage < totalPages - 2) pages.push("ellipsis");
                pages.push(totalPages);
              }

              return pages.map((page, idx) =>
                page === "ellipsis" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 text-zinc-500 dark:text-zinc-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`w-10 h-10 rounded-md text-sm font-medium transition-colors ${
                      page === currentPage
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {page}
                  </button>
                )
              );
            })()}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!paginationInfo.hasNextPage}
            className="px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Next
          </button>
        </div>
      )}

      {/* Page info */}
      {paginationInfo && paginationInfo.totalCount > 0 && (
        <div className="mt-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Showing {(currentPage - 1) * PAGE_SIZE + 1}–
          {Math.min(currentPage * PAGE_SIZE, paginationInfo.totalCount)} of{" "}
          {paginationInfo.totalCount} photos
        </div>
      )}
    </div>
  );
}
