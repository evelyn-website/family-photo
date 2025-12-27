import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState, useEffect } from "react";
import { PhotoFeed } from "./components/PhotoFeed";
import { UploadPhoto } from "./components/UploadPhoto";
import { UserProfile } from "./components/UserProfile";
import { Collections } from "./components/Collections";
import { EditorialFeed } from "./components/EditorialFeed";
import { AdminPanel } from "./components/AdminPanel";
import { PhotoCacheProvider } from "./lib/PhotoCacheContext";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";
import { Id } from "../convex/_generated/dataModel";

type View =
  | "feed"
  | "editorial"
  | "upload"
  | "profile"
  | "collections"
  | "admin";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  // Sun icon for dark mode (clicking switches to light)
  const SunIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );

  // Moon icon for light mode (clicking switches to dark)
  const MoonIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );

  return (
    <button
      onClick={() => toggleTheme()}
      type="button"
      className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function AppContent() {
  const [currentView, setCurrentView] = useState<View>("feed");
  const [selectedUserId, setSelectedUserId] = useState<Id<"users"> | null>(
    null
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const user = useQuery(api.auth.loggedInUser);

  // Initialize state from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view") as View | null;
    const userIdParam = params.get("userId") as Id<"users"> | null;
    const tagsParam = params.get("tags");

    if (
      viewParam &&
      [
        "feed",
        "editorial",
        "upload",
        "profile",
        "collections",
        "admin",
      ].includes(viewParam)
    ) {
      setCurrentView(viewParam);
    } else {
      // No valid view param, set default and update URL
      setCurrentView("feed");
      params.set("view", "feed");
      const newURL = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, "", newURL);
    }

    if (userIdParam) {
      setSelectedUserId(userIdParam);
    }

    if (tagsParam) {
      setSelectedTags(tagsParam.split(",").filter(Boolean));
    }
  }, []);

  // Listen to browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get("view") as View | null;
      const userIdParam = params.get("userId") as Id<"users"> | null;
      const tagsParam = params.get("tags");

      if (
        viewParam &&
        [
          "feed",
          "editorial",
          "upload",
          "profile",
          "collections",
          "admin",
        ].includes(viewParam)
      ) {
        setCurrentView(viewParam);
      } else {
        setCurrentView("feed");
      }

      setSelectedUserId(userIdParam);
      if (tagsParam) {
        setSelectedTags(tagsParam.split(",").filter(Boolean));
      } else {
        setSelectedTags([]);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Helper function to update URL without adding to history
  const updateURL = (
    view: View,
    userId?: Id<"users"> | null,
    replace = false
  ) => {
    const params = new URLSearchParams(window.location.search);

    // Preserve photo param if it exists
    const photoParam = params.get("photo");
    // Preserve tags param if it exists
    const tagsParam = params.get("tags");

    params.set("view", view);

    // Only preserve userId if navigating to profile view
    if (view === "profile" && userId) {
      params.set("userId", userId);
    } else {
      params.delete("userId");
    }

    // Restore photo param if it existed
    if (photoParam) {
      params.set("photo", photoParam);
    }

    // Restore tags param if it existed
    if (tagsParam) {
      params.set("tags", tagsParam);
    }

    const newURL = `${window.location.pathname}?${params.toString()}`;

    if (replace) {
      window.history.replaceState({}, "", newURL);
    } else {
      window.history.pushState({}, "", newURL);
    }
  };

  // Tag filter handlers
  const handleAddTag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase();
    if (normalizedTag && !selectedTags.includes(normalizedTag)) {
      const newTags = [...selectedTags, normalizedTag];
      setSelectedTags(newTags);
      updateURLWithTags(newTags);
    }
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = selectedTags.filter((t) => t !== tag);
    setSelectedTags(newTags);
    updateURLWithTags(newTags);
  };

  const handleClearTags = () => {
    setSelectedTags([]);
    updateURLWithTags([]);
  };

  const updateURLWithTags = (tags: string[]) => {
    const params = new URLSearchParams(window.location.search);

    if (tags.length > 0) {
      params.set("tags", tags.join(","));
    } else {
      params.delete("tags");
    }

    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newURL);
  };

  const handleUserClick = (userId: Id<"users">) => {
    setSelectedUserId(userId);
    setCurrentView("profile");
    updateURL("profile", userId);
  };

  const handleProfileView = () => {
    setSelectedUserId(null); // Reset to current user's profile
    setCurrentView("profile");
    updateURL("profile", null);
  };

  const navigateToView = (view: View) => {
    setCurrentView(view);
    // Preserve userId only if navigating to profile
    if (view === "profile" && selectedUserId) {
      updateURL(view, selectedUserId);
    } else {
      updateURL(view, null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
          <button
            onClick={() => navigateToView("feed")}
            className="text-xl font-bold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
          >
            Family Photo
          </button>

          <Authenticated>
            <nav className="flex items-center gap-4 lg:gap-6">
              <button
                onClick={() => navigateToView("feed")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "feed"
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                All Photos
              </button>
              <button
                onClick={() => navigateToView("editorial")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "editorial"
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Editorial
              </button>
              <button
                onClick={() => navigateToView("collections")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "collections"
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Collections
              </button>
              <button
                onClick={() => navigateToView("upload")}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Upload
              </button>
              <button
                onClick={handleProfileView}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "profile"
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => navigateToView("admin")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "admin"
                    ? "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Admin
              </button>
              <ThemeToggle />
              <SignOutButton />
            </nav>
          </Authenticated>

          <Unauthenticated>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                Sign in to share your photos
              </span>
              <ThemeToggle />
            </div>
          </Unauthenticated>
        </div>
      </header>

      <main className="flex-1">
        <Authenticated>
          <div className="max-w-6xl mx-auto px-4 py-8">
            {currentView === "feed" && (
              <PhotoFeed
                onUserClick={handleUserClick}
                selectedTags={selectedTags}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                onClearTags={handleClearTags}
              />
            )}
            {currentView === "editorial" && (
              <EditorialFeed
                onUserClick={handleUserClick}
                selectedTags={selectedTags}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                onClearTags={handleClearTags}
              />
            )}
            {currentView === "upload" && <UploadPhoto />}
            {currentView === "profile" && user && (
              <UserProfile
                userId={selectedUserId || user._id}
                selectedTags={selectedTags}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                onClearTags={handleClearTags}
              />
            )}
            {currentView === "collections" && <Collections />}
            {currentView === "admin" && <AdminPanel />}
          </div>
        </Authenticated>

        <Unauthenticated>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-md mx-auto px-4">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                  Welcome to Family Photo
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Share and organize your family memories
                </p>
              </div>
              <SignInForm />
            </div>
          </div>
        </Unauthenticated>
      </main>

      <Toaster richColors />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PhotoCacheProvider>
        <AppContent />
      </PhotoCacheProvider>
    </ThemeProvider>
  );
}
