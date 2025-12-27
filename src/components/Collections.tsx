import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function Collections() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);

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
    } catch (error) {
      console.error("Failed to create collection:", error);
      toast.error("Failed to create collection");
    }
  };

  if (publicCollections === undefined) {
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
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
        >
          {showCreateForm ? "Cancel" : "Create Collection"}
        </button>
      </div>

      {showCreateForm && (
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

      <div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Public Collections
        </h3>
        {publicCollections.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 dark:text-zinc-500">
            No public collections yet
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publicCollections.map((collection) => (
              <div
                key={collection._id}
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
