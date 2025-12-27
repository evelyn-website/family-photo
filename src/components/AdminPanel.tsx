import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function AdminPanel() {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const currentUser = useQuery(api.auth.loggedInUser);
  const currentPeriod = useQuery(api.editorial.getCurrentEditorialPeriod);
  const createEditorialPeriod = useMutation(
    api.editorial.createEditorialPeriod
  );

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId || !startDate || !endDate) {
      toast.error("Please fill in all fields");
      return;
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    if (start >= end) {
      toast.error("End date must be after start date");
      return;
    }

    try {
      await createEditorialPeriod({
        curatorId: selectedUserId as any,
        startDate: start,
        endDate: end,
      });

      setSelectedUserId("");
      setStartDate("");
      setEndDate("");
      toast.success("Editorial period created successfully!");
    } catch (error) {
      console.error("Failed to create editorial period:", error);
      toast.error("Failed to create editorial period");
    }
  };

  if (!currentUser) {
    return <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Admin Panel
      </h2>

      {/* Current Editorial Period */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Current Editorial Period
        </h3>
        {currentPeriod ? (
          <div className="space-y-2 text-zinc-700 dark:text-zinc-300">
            <p>
              <strong className="text-zinc-900 dark:text-zinc-100">
                Curator:
              </strong>{" "}
              {currentPeriod.curator.name}
            </p>
            <p>
              <strong className="text-zinc-900 dark:text-zinc-100">
                Start:
              </strong>{" "}
              {new Date(currentPeriod.startDate).toLocaleDateString()}
            </p>
            <p>
              <strong className="text-zinc-900 dark:text-zinc-100">End:</strong>{" "}
              {new Date(currentPeriod.endDate).toLocaleDateString()}
            </p>
            <p>
              <strong className="text-zinc-900 dark:text-zinc-100">
                Status:
              </strong>
              <span className="ml-2 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-sm rounded-full">
                Active
              </span>
            </p>
          </div>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400">
            No active editorial period
          </p>
        )}
      </div>

      {/* Create New Editorial Period */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Create New Editorial Period
        </h3>
        <form
          onSubmit={(e) => void handleCreatePeriod(e)}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Curator User ID
            </label>
            <input
              type="text"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              placeholder="Enter user ID (e.g., your own ID)"
            />
            <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-1">
              Your user ID: {currentUser._id}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Start Date
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              End Date
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-violet-600 text-white py-3 px-4 rounded-md font-medium hover:bg-violet-700 transition-colors"
          >
            Create Editorial Period
          </button>
        </form>

        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-md">
          <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2">
            Instructions:
          </h4>
          <ol className="text-sm text-amber-700 dark:text-amber-400 space-y-1 list-decimal list-inside">
            <li>
              Copy your user ID from above and paste it in the "Curator User ID"
              field
            </li>
            <li>
              Set start and end dates for the editorial period (typically 1
              week)
            </li>
            <li>
              Click "Create Editorial Period" to make yourself the active
              curator
            </li>
            <li>
              Once active, you can add photos to the editorial feed from the
              main photo feed
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
