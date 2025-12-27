import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState } from "react";
import { PhotoFeed } from "./components/PhotoFeed";
import { UploadPhoto } from "./components/UploadPhoto";
import { UserProfile } from "./components/UserProfile";
import { Collections } from "./components/Collections";
import { EditorialFeed } from "./components/EditorialFeed";
import { AdminPanel } from "./components/AdminPanel";
import { PhotoCacheProvider } from "./lib/PhotoCacheContext";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";

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
  const user = useQuery(api.auth.loggedInUser);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Family Photo
          </h1>

          <Authenticated>
            <nav className="flex items-center gap-4 lg:gap-6">
              <button
                onClick={() => setCurrentView("feed")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "feed"
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                All Photos
              </button>
              <button
                onClick={() => setCurrentView("editorial")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "editorial"
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Editorial
              </button>
              <button
                onClick={() => setCurrentView("collections")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "collections"
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Collections
              </button>
              <button
                onClick={() => setCurrentView("upload")}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Upload
              </button>
              <button
                onClick={() => setCurrentView("profile")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "profile"
                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setCurrentView("admin")}
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
            {currentView === "feed" && <PhotoFeed />}
            {currentView === "editorial" && <EditorialFeed />}
            {currentView === "upload" && <UploadPhoto />}
            {currentView === "profile" && user && (
              <UserProfile userId={user._id} />
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
