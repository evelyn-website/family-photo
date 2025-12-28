import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TagFilter } from "./TagFilter";
import { PhotoGrid } from "./PhotoGrid";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { toast } from "sonner";
import { usePhotoCache } from "../lib/PhotoCacheContext";

const PAGE_SIZE = 24;

interface UserProfileProps {
  userId: Id<"users">;
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
  onCollectionClick?: (collectionId: Id<"collections">) => void;
}

export function UserProfile({
  userId,
  selectedTags,
  onAddTag,
  onRemoveTag,
  onClearTags,
  onCollectionClick,
}: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [activeTab, setActiveTab] = useState("photos");
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [collectionIsPublic, setCollectionIsPublic] = useState(true);

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

  // Reset page when userId changes
  useEffect(() => {
    setCurrentPage(1);
  }, [userId]);

  const profile = useQuery(api.profiles.getProfile, { userId });
  const currentUser = useQuery(api.auth.loggedInUser);
  const isAnonymous = useQuery(api.auth.isAnonymousUser);
  const isCurrentCurator = useQuery(api.editorial.isCurrentCurator);

  // Check if we have valid cached data for this page
  const cacheKey = `userPhotos-${userId}-page-${currentPage}`;
  const shouldSkipFetch = isCacheValid(cacheKey);

  const paginatedUserPhotos = useQuery(
    api.photos.getPaginatedUserPhotos,
    shouldSkipFetch
      ? "skip"
      : { userId, page: currentPage, pageSize: PAGE_SIZE }
  );

  const userCollections = useQuery(api.collections.getUserCollections, {
    userId,
  });
  const updateProfile = useMutation(api.profiles.updateProfile);
  const createCollection = useMutation(api.collections.createCollection);

  const isOwnProfile = currentUser?._id === userId;
  const canEditProfile = isOwnProfile && !isAnonymous;

  // Use cached photos if available, otherwise use fetched
  const cachedPage = getCachedPage(cacheKey);
  const rawPhotos = shouldSkipFetch
    ? cachedPage?.photos
    : paginatedUserPhotos?.photos;
  const paginationInfo = shouldSkipFetch ? cachedPage : paginatedUserPhotos;

  // Sync page state with server response if page was clamped
  useEffect(() => {
    if (paginatedUserPhotos && paginatedUserPhotos.page !== currentPage) {
      setCurrentPage(paginatedUserPhotos.page);
      updatePageInURL(paginatedUserPhotos.page);
    }
  }, [paginatedUserPhotos, currentPage, updatePageInURL]);

  // Normalize photos with tags and user info
  const normalizedPhotos = useMemo(() => {
    if (!rawPhotos) return undefined;
    return rawPhotos.map((photo) => ({
      ...photo,
      tags: photo.tags ?? [],
      user: {
        name:
          profile?.displayName ||
          profile?.name ||
          profile?.email ||
          "Anonymous",
        email: profile?.email,
      },
    }));
  }, [rawPhotos, profile]);

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
  const enrichedPhotos = useMemo(() => {
    if (!normalizedPhotos) return undefined;
    return normalizedPhotos.map((photo) => ({
      ...photo,
      isInEditorial: editorialSet.has(photo._id),
    }));
  }, [normalizedPhotos, editorialSet]);

  // Populate cache and preload images when photos are loaded
  useEffect(() => {
    if (paginatedUserPhotos && !shouldSkipFetch) {
      const normalizedPhotosForCache = paginatedUserPhotos.photos.map(
        (photo) => ({
          ...photo,
          tags: photo.tags ?? [],
        })
      );
      const normalizedPaginationInfo = {
        ...paginatedUserPhotos,
        photos: normalizedPhotosForCache,
      };
      setPhotos(
        normalizedPhotosForCache as any,
        cacheKey,
        normalizedPaginationInfo as any
      );

      for (const photo of paginatedUserPhotos.photos) {
        if (photo.url) {
          preloadImage(photo._id as Id<"photos">, photo.url);
        }
      }
    }
  }, [paginatedUserPhotos, shouldSkipFetch, setPhotos, preloadImage, cacheKey]);

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

  // Page navigation handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updatePageInURL(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isPhotosLoading = !enrichedPhotos && !shouldSkipFetch;

  const handleEditProfile = () => {
    if (profile) {
      setDisplayName(profile.displayName || "");
      setBio(profile.bio || "");
      setIsEditing(true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        bio: bio.trim() || undefined,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionName.trim()) {
      toast.error("Please provide a collection name");
      return;
    }

    try {
      await createCollection({
        name: collectionName.trim(),
        description: collectionDescription.trim() || undefined,
        isPublic: collectionIsPublic,
      });
      toast.success("Collection created successfully!");
      setCollectionName("");
      setCollectionDescription("");
      setCollectionIsPublic(true);
      setShowCreateCollection(false);
    } catch (error: any) {
      console.error("Failed to create collection:", error);
      toast.error(error.message || "Failed to create collection");
    }
  };

  if (profile === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
          User not found
        </h3>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {profile.displayName ||
                profile.name ||
                profile.email ||
                "Anonymous"}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">{profile.email}</p>
          </div>
          {canEditProfile && (
            <button
              onClick={handleEditProfile}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {isEditing ? (
          <form
            onSubmit={(e) => void handleSaveProfile(e)}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                placeholder="Tell us about yourself..."
              />
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
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          profile.bio && (
            <p className="text-zinc-700 dark:text-zinc-300">{profile.bio}</p>
          )
        )}
      </div>

      {/* Tabs for Photos and Collections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="photos">
            Photos ({paginationInfo?.totalCount ?? 0})
          </TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="photos">
          <TagFilter
            selectedTags={selectedTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            onClearTags={onClearTags}
          />
          <PhotoGrid
            photos={enrichedPhotos}
            allPhotos={enrichedPhotos}
            selectedTags={selectedTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            showEditorialActions={isCurrentCurator}
            isLoading={isPhotosLoading}
            noPhotosMessage={{
              title: isOwnProfile
                ? "You haven't uploaded any photos yet"
                : "No photos uploaded yet",
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
        </TabsContent>

        <TabsContent value="collections">
          {isOwnProfile && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={() => setShowCreateCollection(!showCreateCollection)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                {showCreateCollection ? "Cancel" : "Create Collection"}
              </button>
            </div>
          )}

          {isOwnProfile && showCreateCollection && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
                Create New Collection
              </h3>
              <form
                onSubmit={(e) => void handleCreateCollection(e)}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
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
                    value={collectionDescription}
                    onChange={(e) => setCollectionDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                    placeholder="Describe your collection (optional)"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="collectionIsPublic"
                    checked={collectionIsPublic}
                    onChange={(e) => setCollectionIsPublic(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
                  />
                  <label
                    htmlFor="collectionIsPublic"
                    className="ml-2 text-sm text-zinc-700 dark:text-zinc-300"
                  >
                    Make this collection public
                  </label>
                </div>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Create Collection
                </button>
              </form>
            </div>
          )}

          {userCollections === undefined ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
            </div>
          ) : userCollections.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 dark:text-zinc-500">
              {isOwnProfile
                ? "You haven't created any collections yet"
                : "No public collections"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userCollections.map((collection: any) => (
                <div
                  key={collection._id}
                  onClick={() => onCollectionClick?.(collection._id)}
                  className={`bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 hover:shadow-md transition-shadow ${
                    onCollectionClick ? "cursor-pointer" : ""
                  }`}
                >
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {collection.name}
                    {collection.isDefault && (
                      <span className="ml-2 text-xs text-zinc-500">
                        (Default)
                      </span>
                    )}
                  </h3>
                  {collection.description && (
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-2">
                      {collection.description}
                    </p>
                  )}
                  <div className="flex justify-between items-center text-sm text-zinc-500 dark:text-zinc-500">
                    <span>{collection.photoCount} photos</span>
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
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
