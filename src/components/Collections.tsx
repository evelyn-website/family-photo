import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { TagFilter } from "./TagFilter";

interface CollectionsProps {
  onCollectionClick: (collectionId: Id<"collections">) => void;
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
}

export function Collections({
  onCollectionClick,
  selectedTags,
  onAddTag,
  onRemoveTag,
  onClearTags,
}: CollectionsProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const currentUser = useQuery(api.auth.loggedInUser);
  const userCollections = useQuery(
    api.collections.getUserCollections,
    currentUser ? { userId: currentUser._id } : "skip"
  );
  const publicCollections = useQuery(api.collections.getPublicCollections);
  const createCollection = useMutation(api.collections.createCollection);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please provide a collection name");
      return;
    }

    try {
      await createCollection({
        name: name.trim(),
        description: description.trim() || undefined,
        isPublic,
      });

      setName("");
      setDescription("");
      setIsPublic(true);
      setShowCreateForm(false);
      toast.success("Collection created successfully!");
    } catch (error: any) {
      console.error("Failed to create collection:", error);
      toast.error(error.message || "Failed to create collection");
    }
  };

  // Filter collections based on selected tags (AND logic)
  const filteredUserCollections = useMemo(() => {
    if (!userCollections) return undefined;
    if (selectedTags.length === 0) return userCollections;
    return userCollections.filter((collection) =>
      selectedTags.every((tag) =>
        (collection.tags || []).some(
          (collectionTag) => collectionTag.toLowerCase() === tag.toLowerCase()
        )
      )
    );
  }, [userCollections, selectedTags]);

  const filteredPublicCollections = useMemo(() => {
    if (!publicCollections) return undefined;
    if (selectedTags.length === 0) return publicCollections;
    return publicCollections.filter((collection) =>
      selectedTags.every((tag) =>
        (collection.tags || []).some(
          (collectionTag) => collectionTag.toLowerCase() === tag.toLowerCase()
        )
      )
    );
  }, [publicCollections, selectedTags]);

  const isLoading =
    currentUser === undefined ||
    (currentUser && userCollections === undefined) ||
    publicCollections === undefined;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Collections
        </h2>
        {currentUser && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            {showCreateForm ? "Cancel" : "Create Collection"}
          </button>
        )}
      </div>

      <TagFilter
        selectedTags={selectedTags}
        onAddTag={onAddTag}
        onRemoveTag={onRemoveTag}
        onClearTags={onClearTags}
      />

      {currentUser && showCreateForm && (
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
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
                placeholder="Describe your collection (optional)"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800"
              />
              <label
                htmlFor="isPublic"
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

      {currentUser && filteredUserCollections && filteredUserCollections.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            My Collections
          </h3>
          {filteredUserCollections.length === 0 && selectedTags.length > 0 ? (
            <div className="text-center py-8 text-zinc-500 dark:text-zinc-500">
              No collections match your filters
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUserCollections.map((collection) => (
                <div
                  key={collection._id}
                  onClick={() => onCollectionClick(collection._id)}
                  className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                    {collection.name}
                    {collection.isDefault && (
                      <span className="ml-2 text-xs text-zinc-500">
                        (Default)
                      </span>
                    )}
                  </h4>
                  {collection.description && (
                    <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-3">
                      {collection.description}
                    </p>
                  )}
                  {collection.tags && collection.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {collection.tags.map((tag, index) => {
                        const normalizedTag = tag.toLowerCase();
                        const isSelected = selectedTags.includes(normalizedTag);
                        const handleTagClick = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (isSelected) {
                            onRemoveTag(normalizedTag);
                          } else {
                            onAddTag(normalizedTag);
                          }
                        };

                        return (
                          <span
                            key={index}
                            onClick={handleTagClick}
                            className={`flex-shrink-0 px-2 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-700 dark:hover:text-indigo-300"
                            }`}
                          >
                            #{tag}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm text-zinc-500 dark:text-zinc-500">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        collection.isPublic
                          ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      {collection.isPublic ? "Public" : "Private"}
                    </span>
                    <span>{collection.photoCount} photos</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Public Collections
        </h3>
        {filteredPublicCollections && filteredPublicCollections.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-500">
            {selectedTags.length > 0
              ? "No public collections match your filters"
              : "No public collections yet"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPublicCollections?.map((collection) => (
              <div
                key={collection._id}
                onClick={() => onCollectionClick(collection._id)}
                className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 hover:shadow-md transition-shadow cursor-pointer"
              >
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {collection.name}
                </h4>
                {collection.description && (
                  <p className="text-zinc-600 dark:text-zinc-400 text-sm mb-3">
                    {collection.description}
                  </p>
                )}
                {collection.tags && collection.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {collection.tags.map((tag, index) => {
                      const normalizedTag = tag.toLowerCase();
                      const isSelected = selectedTags.includes(normalizedTag);
                      const handleTagClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (isSelected) {
                          onRemoveTag(normalizedTag);
                        } else {
                          onAddTag(normalizedTag);
                        }
                      };

                      return (
                        <span
                          key={index}
                          onClick={handleTagClick}
                          className={`flex-shrink-0 px-2 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/70"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-700 dark:hover:text-indigo-300"
                          }`}
                        >
                          #{tag}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-between items-center text-sm text-zinc-500 dark:text-zinc-500">
                  <span>by {collection.owner.name}</span>
                  <span>{collection.photoCount} photos</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
