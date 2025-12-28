import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TagFilter } from "./TagFilter";
import { PhotoGrid } from "./PhotoGrid";
import { usePhotoCache } from "../lib/usePhotoCache";

const PAGE_SIZE = 24;

interface EditorialFeedProps {
  onUserClick?: (userId: Id<"users">) => void;
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
}

export function EditorialFeed({
  onUserClick,
  selectedTags,
  onAddTag,
  onRemoveTag,
  onClearTags,
}: EditorialFeedProps) {
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
  const cacheKey = `editorial-page-${currentPage}`;
  const shouldSkipFetch = isCacheValid(cacheKey);

  // Fetch paginated data
  const paginatedResult = useQuery(
    api.editorial.getPaginatedEditorialFeed,
    shouldSkipFetch ? "skip" : { page: currentPage, pageSize: PAGE_SIZE }
  );

  const currentPeriod = useQuery(api.editorial.getCurrentEditorialPeriod);
  const isCurrentCurator = useQuery(api.editorial.isCurrentCurator);

  // Use cached photos if available, otherwise use fetched
  const cachedPage = getCachedPage(cacheKey);
  const rawPhotos = shouldSkipFetch
    ? cachedPage?.photos
    : paginatedResult?.photos;
  const paginationInfo = shouldSkipFetch ? cachedPage : paginatedResult;

  // Sync page state with server response if page was clamped
  useEffect(() => {
    if (paginatedResult && paginatedResult.page !== currentPage) {
      setCurrentPage(paginatedResult.page);
      updatePageInURL(paginatedResult.page);
    }
  }, [paginatedResult, currentPage, updatePageInURL]);

  // Normalize photos to ensure tags are always arrays
  const sortedPhotos = useMemo(() => {
    if (!rawPhotos) return undefined;
    return rawPhotos.map((photo) => ({
      ...photo,
      tags: photo.tags ?? [],
    }));
  }, [rawPhotos]);

  // Populate cache and preload images when photos are loaded
  useEffect(() => {
    if (paginatedResult && !shouldSkipFetch) {
      const normalizedPhotos = paginatedResult.photos.map((photo) => ({
        ...photo,
        tags: photo.tags ?? [],
      }));
      const normalizedPaginationInfo = {
        ...paginatedResult,
        photos: normalizedPhotos,
      };
      setPhotos(
        normalizedPhotos as any,
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
  const isLoading = !sortedPhotos && !shouldSkipFetch;

  // Page navigation handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePageInURL(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (currentPeriod === undefined) {
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

      <TagFilter
        selectedTags={selectedTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onClearTags={onClearTags}
      />

      <PhotoGrid
        photos={sortedPhotos}
        allPhotos={sortedPhotos}
        selectedTags={selectedTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onUserClick={onUserClick}
        showEditorialActions={isCurrentCurator}
        isInEditorial={true}
        showFavoritesButton={false}
        isLoading={isLoading}
        noPhotosMessage={{
          title: "No photos selected yet",
          description: isCurrentCurator
            ? "Start curating by adding photos from the main feed!"
            : "The curator hasn't selected any photos yet.",
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
