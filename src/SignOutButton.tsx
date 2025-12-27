"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

type SignOutButtonProps = {
  variant?: "default" | "menu";
};

export function SignOutButton({ variant = "default" }: SignOutButtonProps) {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  const baseClasses =
    variant === "menu"
      ? "w-full text-left px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
      : "px-4 py-2 rounded bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors shadow-sm hover:shadow";

  return (
    <button
      className={baseClasses}
      onClick={() => void signOut()}
    >
      Sign out
    </button>
  );
}
