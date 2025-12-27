import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PhotoCard } from "./PhotoCard";

interface UserProfileProps {
  userId: Id<"users">;
}

export function UserProfile({ userId }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  
  const profile = useQuery(api.profiles.getProfile, { userId });
  const currentUser = useQuery(api.auth.loggedInUser);
  const userPhotos = useQuery(api.photos.getUserPhotos, { userId });
  const userCollections = useQuery(api.collections.getUserCollections, { userId });
  const updateProfile = useMutation(api.profiles.updateProfile);

  const isOwnProfile = currentUser?._id === userId;

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

  if (profile === undefined || userPhotos === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">User not found</h3>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {profile.displayName || profile.name || "Anonymous"}
            </h1>
            <p className="text-gray-600">{profile.email}</p>
          </div>
          {isOwnProfile && (
            <button
              onClick={handleEditProfile}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tell us about yourself..."
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          profile.bio && (
            <p className="text-gray-700">{profile.bio}</p>
          )
        )}
      </div>

      {/* Photos Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Photos ({userPhotos.length})
        </h2>
        {userPhotos.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {isOwnProfile ? "You haven't uploaded any photos yet" : "No photos uploaded yet"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userPhotos.map((photo) => (
              <PhotoCard
                key={photo._id}
                photo={{
                  ...photo,
                  user: {
                    name: profile.displayName || profile.name || "Anonymous",
                    email: profile.email,
                  },
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Collections Section */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Collections</h2>
        {userCollections === undefined ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : userCollections.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {isOwnProfile ? "You haven't created any collections yet" : "No public collections"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userCollections.map((collection: any) => (
              <div
                key={collection._id}
                className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-gray-900 mb-2">{collection.name}</h3>
                {collection.description && (
                  <p className="text-gray-600 text-sm mb-2">{collection.description}</p>
                )}
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>{collection.photoCount} photos</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    collection.isPublic 
                      ? "bg-green-100 text-green-700" 
                      : "bg-gray-100 text-gray-700"
                  }`}>
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
