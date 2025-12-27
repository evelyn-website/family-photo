import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { TagFilter } from "./TagFilter";
import { PhotoGrid } from "./PhotoGrid";

interface UserProfileProps {
  userId: Id<"users">;
  selectedTags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  onClearTags: () => void;
}

export function UserProfile({
  userId,
  selectedTags,
  onAddTag,
  onRemoveTag,
  onClearTags,
}: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");

  const profile = useQuery(api.profiles.getProfile, { userId });
  const currentUser = useQuery(api.auth.loggedInUser);
  const isAnonymous = useQuery(api.auth.isAnonymousUser);
  const allUserPhotos = useQuery(api.photos.getUserPhotos, { userId });
  const userCollections = useQuery(api.collections.getUserCollections, {
    userId,
  });
  const updateProfile = useMutation(api.profiles.updateProfile);

  const isOwnProfile = currentUser?._id === userId;
  const canEditProfile = isOwnProfile && !isAnonymous;

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

  if (profile === undefined || allUserPhotos === undefined) {
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

      {/* Photos Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Photos ({allUserPhotos?.length || 0})
        </h2>
        <TagFilter
          selectedTags={selectedTags}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          onClearTags={onClearTags}
        />
        <PhotoGrid
          photos={allUserPhotos?.map((photo) => ({
            ...photo,
            user: {
              name:
                profile.displayName ||
                profile.name ||
                profile.email ||
                "Anonymous",
              email: profile.email,
            },
          }))}
          allPhotos={allUserPhotos?.map((photo) => ({
            ...photo,
            user: {
              name:
                profile.displayName ||
                profile.name ||
                profile.email ||
                "Anonymous",
              email: profile.email,
            },
          }))}
          selectedTags={selectedTags}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
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
      </div>

      {/* Collections Section */}
      <div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          Collections
        </h2>
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
                className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  {collection.name}
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
      </div>
    </div>
  );
}
