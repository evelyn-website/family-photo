import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function AdminPanel() {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminUserId, setNewAdminUserId] = useState("");
  const [adminMethod, setAdminMethod] = useState<"email" | "userId">("email");

  const currentUser = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.auth.isAdmin);
  const currentPeriod = useQuery(api.editorial.getCurrentEditorialPeriod);
  const allowedEmails = useQuery(api.allowlist.listAllowedEmails);
  const admins = useQuery(api.admins.listAdmins);

  const createEditorialPeriod = useMutation(
    api.editorial.createEditorialPeriod
  );
  const addEmail = useMutation(api.allowlist.addEmail);
  const removeEmail = useMutation(api.allowlist.removeEmail);
  const addAdmin = useMutation(api.admins.addAdmin);
  const removeAdmin = useMutation(api.admins.removeAdmin);

  // Redirect if not admin
  if (currentUser && isAdmin === false) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-red-900 dark:text-red-100 mb-2">
            Access Denied
          </h2>
          <p className="text-red-700 dark:text-red-300">
            You must be an admin to access this panel.
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser || isAdmin === undefined) {
    return <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>;
  }

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

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    try {
      await addEmail({ email: newEmail.trim() });
      setNewEmail("");
      toast.success("Email added to allowlist!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add email");
    }
  };

  const handleRemoveEmail = async (email: string) => {
    if (
      !confirm(`Are you sure you want to remove ${email} from the allowlist?`)
    ) {
      return;
    }

    try {
      await removeEmail({ email });
      toast.success("Email removed from allowlist");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove email");
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (adminMethod === "email") {
        if (!newAdminEmail.trim()) {
          toast.error("Please enter an email address");
          return;
        }
        await addAdmin({ email: newAdminEmail.trim() });
        setNewAdminEmail("");
      } else {
        if (!newAdminUserId.trim()) {
          toast.error("Please enter a user ID");
          return;
        }
        await addAdmin({ userId: newAdminUserId.trim() as any });
        setNewAdminUserId("");
      }
      toast.success("Admin added successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to add admin");
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this admin?")) {
      return;
    }

    try {
      await removeAdmin({ userId: userId as any });
      toast.success("Admin removed successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove admin");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
        Admin Panel
      </h2>

      {/* Allowlist Management */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Email Allowlist
        </h3>

        {/* Add Email Form */}
        <form onSubmit={(e) => void handleAddEmail(e)} className="mb-6">
          <div className="flex gap-2">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter email address"
              className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="submit"
              className="bg-violet-600 text-white px-4 py-2 rounded-md font-medium hover:bg-violet-700 transition-colors"
            >
              Add Email
            </button>
          </div>
        </form>

        {/* Email List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Allowed Emails ({allowedEmails?.length || 0})
          </h4>
          {allowedEmails && allowedEmails.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allowedEmails.map((item) => {
                const isOwnEmail =
                  currentUser.email?.toLowerCase().trim() ===
                  item.email.toLowerCase().trim();
                return (
                  <div
                    key={item._id}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-md"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {item.email}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Added {new Date(item.addedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleRemoveEmail(item.email)}
                      disabled={isOwnEmail}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        isOwnEmail
                          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                          : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/70"
                      }`}
                      title={
                        isOwnEmail
                          ? "You cannot remove your own email"
                          : "Remove email"
                      }
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No emails in allowlist
            </p>
          )}
        </div>
      </div>

      {/* Admin Management */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Admin Management
        </h3>

        {/* Add Admin Form */}
        <form onSubmit={(e) => void handleAddAdmin(e)} className="mb-6">
          <div className="mb-3">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Add Admin By
            </label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="email"
                  checked={adminMethod === "email"}
                  onChange={(e) =>
                    setAdminMethod(e.target.value as "email" | "userId")
                  }
                  className="mr-2"
                />
                Email
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="userId"
                  checked={adminMethod === "userId"}
                  onChange={(e) =>
                    setAdminMethod(e.target.value as "email" | "userId")
                  }
                  className="mr-2"
                />
                User ID
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            {adminMethod === "email" ? (
              <input
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            ) : (
              <input
                type="text"
                value={newAdminUserId}
                onChange={(e) => setNewAdminUserId(e.target.value)}
                placeholder="Enter user ID"
                className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            )}
            <button
              type="submit"
              className="bg-violet-600 text-white px-4 py-2 rounded-md font-medium hover:bg-violet-700 transition-colors"
            >
              Add Admin
            </button>
          </div>
        </form>

        {/* Admin List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
            Current Admins ({admins?.length || 0})
          </h4>
          {admins && admins.length > 0 ? (
            <div className="space-y-2">
              {admins.map((admin) => {
                const isOwnAdmin = admin._id === currentUser._id;
                return (
                  <div
                    key={admin._id}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-md"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {admin.name || admin.email || "Unknown User"}
                        {isOwnAdmin && (
                          <span className="ml-2 px-2 py-0.5 bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-xs rounded-full">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {admin.email || "No email"}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Joined{" "}
                        {new Date(admin._creationTime).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleRemoveAdmin(admin._id)}
                      disabled={isOwnAdmin}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        isOwnAdmin
                          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                          : "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/70"
                      }`}
                      title={
                        isOwnAdmin
                          ? "You cannot remove your own admin status"
                          : "Remove admin"
                      }
                    >
                      Remove Admin
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No admins found
            </p>
          )}
        </div>
      </div>

      {/* Current Editorial Period */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
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
      </div>
    </div>
  );
}
