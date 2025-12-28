import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function AdminPanel() {
  const [curatorEmail, setCuratorEmail] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminUserId, setNewAdminUserId] = useState("");
  const [adminMethod, setAdminMethod] = useState<"email" | "userId">("email");
  const [showHistory, setShowHistory] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<
    Array<{ _id: string; email?: string; name?: string }>
  >([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const currentUser = useQuery(api.auth.loggedInUser);
  const isAdmin = useQuery(api.auth.isAdmin);
  const allPeriods = useQuery(api.editorial.listAllEditorialPeriods);
  const allowedEmails = useQuery(api.allowlist.listAllowedEmails);
  const admins = useQuery(api.admins.listAdmins);
  const userSuggestions = useQuery(
    api.editorial.searchUsersByEmail,
    curatorEmail.trim().length >= 2
      ? { searchTerm: curatorEmail.trim(), limit: 10 }
      : "skip"
  );

  const createEditorialPeriodByEmail = useMutation(
    api.editorial.createEditorialPeriodByEmail
  );
  const addEmail = useMutation(api.allowlist.addEmail);
  const removeEmail = useMutation(api.allowlist.removeEmail);
  const addAdmin = useMutation(api.admins.addAdmin);
  const removeAdmin = useMutation(api.admins.removeAdmin);

  // Auto-populate start and end dates based on existing periods
  useEffect(() => {
    if (!allPeriods || startDate) return; // Only run if startDate is not set

    const now = Date.now();
    const futureOrActivePeriods = allPeriods.filter(
      (period) => period.endDate >= now
    );

    let suggestedStartDate: Date;

    if (futureOrActivePeriods.length === 0) {
      // No active or future periods, use right now
      suggestedStartDate = new Date();
    } else {
      // Find the latest period by endDate
      const latestPeriod = futureOrActivePeriods.reduce((latest, period) =>
        period.endDate > latest.endDate ? period : latest
      );
      // One week after the latest period's end date
      suggestedStartDate = new Date(latestPeriod.endDate);
      suggestedStartDate.setDate(suggestedStartDate.getDate() + 7);
    }

    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const year = suggestedStartDate.getFullYear();
    const month = String(suggestedStartDate.getMonth() + 1).padStart(2, "0");
    const day = String(suggestedStartDate.getDate()).padStart(2, "0");
    const hours = String(suggestedStartDate.getHours()).padStart(2, "0");
    const minutes = String(suggestedStartDate.getMinutes()).padStart(2, "0");
    const formattedStart = `${year}-${month}-${day}T${hours}:${minutes}`;
    setStartDate(formattedStart);

    // Auto-populate end date (one week after start date)
    const suggestedEndDate = new Date(suggestedStartDate);
    suggestedEndDate.setDate(suggestedEndDate.getDate() + 7);
    const endYear = suggestedEndDate.getFullYear();
    const endMonth = String(suggestedEndDate.getMonth() + 1).padStart(2, "0");
    const endDay = String(suggestedEndDate.getDate()).padStart(2, "0");
    const endHours = String(suggestedEndDate.getHours()).padStart(2, "0");
    const endMinutes = String(suggestedEndDate.getMinutes()).padStart(2, "0");
    setEndDate(`${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`);
  }, [allPeriods, startDate]);

  // Auto-update end date when start date changes (only if end date is empty)
  useEffect(() => {
    if (!startDate || endDate) return; // Only run if startDate is set but endDate is not

    const start = new Date(startDate);
    const suggestedEndDate = new Date(start);
    suggestedEndDate.setDate(suggestedEndDate.getDate() + 7);
    const endYear = suggestedEndDate.getFullYear();
    const endMonth = String(suggestedEndDate.getMonth() + 1).padStart(2, "0");
    const endDay = String(suggestedEndDate.getDate()).padStart(2, "0");
    const endHours = String(suggestedEndDate.getHours()).padStart(2, "0");
    const endMinutes = String(suggestedEndDate.getMinutes()).padStart(2, "0");
    setEndDate(`${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`);
  }, [startDate, endDate]);

  // Update suggestions when userSuggestions query result changes
  useEffect(() => {
    if (userSuggestions) {
      setEmailSuggestions(userSuggestions);
      setShowSuggestions(
        userSuggestions.length > 0 && curatorEmail.trim().length >= 2
      );
      setSelectedSuggestionIndex(-1);
    } else {
      setEmailSuggestions([]);
      setShowSuggestions(false);
    }
  }, [userSuggestions, curatorEmail]);

  // Handle keyboard navigation in typeahead
  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || emailSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < emailSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      const selected = emailSuggestions[selectedSuggestionIndex];
      if (selected?.email) {
        setCuratorEmail(selected.email);
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const handleSuggestionClick = (email: string) => {
    setCuratorEmail(email);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    emailInputRef.current?.focus();
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emailInputRef.current &&
        !emailInputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

    if (!curatorEmail || !startDate || !endDate) {
      toast.error("Please fill in all fields");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(curatorEmail.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    if (start >= end) {
      toast.error("End date must be after start date");
      return;
    }

    try {
      await createEditorialPeriodByEmail({
        curatorEmail: curatorEmail.trim(),
        startDate: start,
        endDate: end,
      });

      setCuratorEmail("");
      setStartDate("");
      setEndDate("");
      toast.success("Editorial period created successfully!");
    } catch (error: any) {
      console.error("Failed to create editorial period:", error);
      // Extract clean error message from Convex error
      let errorMessage = "Failed to create editorial period";

      if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.message) {
        // Parse Convex error format: extract message after "Uncaught Error: " and before " at "
        const parts = error.message.split("Uncaught Error: ");
        if (parts.length > 1) {
          errorMessage = parts[1].split(" at ")[0].trim();
        } else {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
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

      {/* Editorial Period Queue */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Editorial Period Queue
          </h3>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium"
          >
            {showHistory ? "Hide History" : "See History"}
          </button>
        </div>
        {allPeriods && allPeriods.length > 0 ? (
          <div className="space-y-3">
            {(showHistory
              ? allPeriods
              : allPeriods.filter((p) => p.endDate >= Date.now())
            ).map((period) => {
              const now = Date.now();
              const isActive =
                period.isActive &&
                period.startDate <= now &&
                period.endDate >= now;
              const isUpcoming = period.startDate > now;
              const isPast = period.endDate < now;

              return (
                <div
                  key={period._id}
                  className={`p-4 rounded-md border ${
                    isActive
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                      : isUpcoming
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {period.curator.name}
                        </p>
                        {isActive && (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs rounded-full">
                            Active
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                            Upcoming
                          </span>
                        )}
                        {isPast && (
                          <span className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-xs rounded-full">
                            Past
                          </span>
                        )}
                      </div>
                      {period.curator.email && (
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                          {period.curator.email}
                        </p>
                      )}
                      <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                        <span>
                          <strong className="text-zinc-900 dark:text-zinc-100">
                            Start:
                          </strong>{" "}
                          {new Date(period.startDate).toLocaleString()}
                        </span>
                        <span>
                          <strong className="text-zinc-900 dark:text-zinc-100">
                            End:
                          </strong>{" "}
                          {new Date(period.endDate).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400">
            No editorial periods configured
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
          <div className="relative">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Curator Email
            </label>
            <input
              ref={emailInputRef}
              type="email"
              value={curatorEmail}
              onChange={(e) => {
                setCuratorEmail(e.target.value);
                setShowSuggestions(e.target.value.trim().length >= 2);
              }}
              onKeyDown={handleEmailKeyDown}
              onFocus={() => {
                if (
                  emailSuggestions.length > 0 &&
                  curatorEmail.trim().length >= 2
                ) {
                  setShowSuggestions(true);
                }
              }}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
              placeholder="Start typing to search users..."
            />
            {showSuggestions && emailSuggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
              >
                {emailSuggestions.map((user, index) => (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => handleSuggestionClick(user.email || "")}
                    className={`w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
                      index === selectedSuggestionIndex
                        ? "bg-violet-100 dark:bg-violet-900/50"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {user.email}
                      </span>
                      {user.name && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {user.name}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
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
