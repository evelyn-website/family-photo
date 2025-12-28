import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TagFilter } from "./TagFilter";
import { PhotoGrid } from "./PhotoGrid";
import { usePhotoCache } from "../lib/usePhotoCache";

const PAGE_SIZE = 24;

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
  const { setPhotos, preloadImage, isCacheValid, getCachedPage } =
    usePhotoCache();

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

  // Check if we have valid cached data for this page
  const cacheKey = `mainFeed-page-${currentPage}`;
  const shouldSkipFetch = isCacheValid(cacheKey);

  // Fetch paginated data
  const paginatedResult = useQuery(
    api.photos.getPaginatedFeed,
    shouldSkipFetch ? "skip" : { page: currentPage, pageSize: PAGE_SIZE }
  );

  const isCurrentCurator = useQuery(api.editorial.isCurrentCurator);

  // Use cached photos if available, otherwise use fetched
  const cachedPage = getCachedPage(cacheKey);
  const rawPhotos = shouldSkipFetch
    ? cachedPage?.photos
    : paginatedResult?.photos;
  const paginationInfo = shouldSkipFetch ? cachedPage : paginatedResult;

  // Sync page state with server response if page was clamped (e.g., page 3 requested but only 1 page exists)
  useEffect(() => {
    if (paginatedResult && paginatedResult.page !== currentPage) {
      setCurrentPage(paginatedResult.page);
      updatePageInURL(paginatedResult.page);
    }
  }, [paginatedResult, currentPage, updatePageInURL]);

  // Normalize photos to ensure tags are always arrays
  const normalizedPhotos = rawPhotos?.map((photo) => ({
    ...photo,
    tags: photo.tags ?? [],
  }));

  // Get photo IDs for editorial status query
  const photoIds = useMemo(() => {
    if (!normalizedPhotos) return [];
    return normalizedPhotos.map((photo) => photo._id);
  }, [normalizedPhotos]);

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
  const allPhotos = useMemo(() => {
    if (!normalizedPhotos) return undefined;
    return normalizedPhotos.map((photo) => ({
      ...photo,
      isInEditorial: editorialSet.has(photo._id),
    }));
  }, [normalizedPhotos, editorialSet]);

  // Populate cache and preload images when photos are loaded from server
  useEffect(() => {
    if (paginatedResult && !shouldSkipFetch) {
      // Normalize photos to ensure tags are arrays before caching
      const normalizedPhotosForCache = paginatedResult.photos.map((photo) => ({
        ...photo,
        tags: photo.tags ?? [],
      }));
      const normalizedPaginationInfo = {
        ...paginatedResult,
        photos: normalizedPhotosForCache,
      };
      setPhotos(
        normalizedPhotosForCache as any,
        cacheKey,
        normalizedPaginationInfo as any
      );

      // Preload all visible images into blob cache
      for (const photo of paginatedResult.photos) {
        if (photo.url) {
          preloadImage(photo._id as Id<"photos">, photo.url);
        }
      }
    }
  }, [paginatedResult, shouldSkipFetch, setPhotos, preloadImage, cacheKey]);

  // Also preload images when using cached data
  useEffect(() => {
    if (shouldSkipFetch && cachedPage?.photos && cachedPage.photos.length > 0) {
      for (const photo of cachedPage.photos) {
        if (photo.url) {
          preloadImage(photo._id, photo.url);
        }
      }
    }
  }, [shouldSkipFetch, cachedPage, preloadImage]);

  // Determine loading state
  const isLoading = !allPhotos && !shouldSkipFetch;

  // Page navigation handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePageInURL(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
        showFavoritesButton={true}
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
            {/* Show page numbers with ellipsis for large page counts */}
            {(() => {
              const pages: (number | "ellipsis")[] = [];
              const totalPages = paginationInfo.totalPages;

              if (totalPages <= 7) {
                // Show all pages if 7 or fewer
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                // Always show first page
                pages.push(1);

                if (currentPage > 3) {
                  pages.push("ellipsis");
                }

                // Show pages around current
                const start = Math.max(2, currentPage - 1);
                const end = Math.min(totalPages - 1, currentPage + 1);

                for (let i = start; i <= end; i++) {
                  pages.push(i);
                }

                if (currentPage < totalPages - 2) {
                  pages.push("ellipsis");
                }

                // Always show last page
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
