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

type View = "feed" | "editorial" | "upload" | "profile" | "collections" | "admin";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("feed");
  const user = useQuery(api.auth.loggedInUser);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Family Photo</h1>
          
          <Authenticated>
            <nav className="flex items-center gap-6">
              <button
                onClick={() => setCurrentView("feed")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "feed" 
                    ? "bg-blue-100 text-blue-700" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All Photos
              </button>
              <button
                onClick={() => setCurrentView("editorial")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "editorial" 
                    ? "bg-blue-100 text-blue-700" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Editorial
              </button>
              <button
                onClick={() => setCurrentView("collections")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "collections" 
                    ? "bg-blue-100 text-blue-700" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Collections
              </button>
              <button
                onClick={() => setCurrentView("upload")}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Upload
              </button>
              <button
                onClick={() => setCurrentView("profile")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "profile" 
                    ? "bg-blue-100 text-blue-700" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setCurrentView("admin")}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentView === "admin" 
                    ? "bg-purple-100 text-purple-700" 
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Admin
              </button>
              <SignOutButton />
            </nav>
          </Authenticated>

          <Unauthenticated>
            <div className="text-sm text-gray-600">
              Sign in to share your photos
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
            {currentView === "profile" && user && <UserProfile userId={user._id} />}
            {currentView === "collections" && <Collections />}
            {currentView === "admin" && <AdminPanel />}
          </div>
        </Authenticated>

        <Unauthenticated>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-md mx-auto px-4">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Welcome to Family Photo
                </h2>
                <p className="text-gray-600">
                  Share and organize your family memories
                </p>
              </div>
              <SignInForm />
            </div>
          </div>
        </Unauthenticated>
      </main>
      
      <Toaster />
    </div>
  );
}
