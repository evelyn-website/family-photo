"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function PasswordResetForm() {
  const { signIn } = useAuthActions();
  const [step, setStep] = useState<"forgot" | { email: string }>("forgot");
  const [submitting, setSubmitting] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;

    formData.set("flow", "reset");
    try {
      await signIn("password", formData);
      setStep({ email });
      toast.success("Password reset code sent to your email");
    } catch (error: any) {
      toast.error(
        error.message || "Could not send reset code. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetVerification = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.target as HTMLFormElement);

    formData.set("flow", "reset-verification");
    formData.set("email", step === "forgot" ? "" : step.email);
    try {
      await signIn("password", formData);
      toast.success("Password reset successful! You can now sign in.");
      setStep("forgot");
    } catch (error: any) {
      let toastTitle = "";
      if (error.message.includes("Invalid") || error.message.includes("code")) {
        toastTitle = "Invalid code. Please try again.";
      } else {
        toastTitle = error.message || "Could not reset password. Please try again.";
      }
      toast.error(toastTitle);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "forgot") {
    return (
      <div className="w-full">
        <form
          className="flex flex-col gap-form-field"
          onSubmit={handleForgotPassword}
        >
          <input
            className="auth-input-field"
            type="email"
            name="email"
            placeholder="Email"
            required
          />
          <button className="auth-button" type="submit" disabled={submitting}>
            {submitting ? "Sending..." : "Send reset code"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        onSubmit={handleResetVerification}
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
          Enter the code sent to {step.email} and your new password.
        </p>
        <input
          className="auth-input-field"
          type="text"
          name="code"
          placeholder="Reset code"
          required
          maxLength={8}
        />
        <input
          className="auth-input-field"
          type="password"
          name="newPassword"
          placeholder="New password"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {submitting ? "Resetting..." : "Reset password"}
        </button>
        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          <button
            type="button"
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium cursor-pointer"
            onClick={() => setStep("forgot")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

