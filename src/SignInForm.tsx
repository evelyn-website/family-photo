"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { PasswordResetForm } from "./components/PasswordResetForm";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp" | "reset">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const checkEmailAllowed = useMutation(
    api.allowlist.checkEmailAllowedMutation
  );
  const validateUserAfterSignup = useMutation(
    api.authValidation.validateUserAfterSignup
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;

    // Check allowlist before attempting sign-up or sign-in
    try {
      const isAllowed = await checkEmailAllowed({ email });
      if (!isAllowed) {
        toast.error(
          "Your email is not on the allowlist. Please contact an administrator."
        );
        setSubmitting(false);
        return;
      }
    } catch (error) {
      console.error("Error checking allowlist:", error);
      toast.error("Could not verify email. Please try again.");
      setSubmitting(false);
      return;
    }

    formData.set("flow", flow);
    try {
      await signIn("password", formData);
      // If sign-up was successful, validate user and set admin status
      if (flow === "signUp") {
        try {
          await validateUserAfterSignup();
        } catch (error: any) {
          // If validation fails, user will be deleted and error thrown
          toast.error(error.message || "Sign-up validation failed");
          setSubmitting(false);
          return;
        }
      }
    } catch (error: any) {
      let toastTitle = "";
      if (error.message.includes("Invalid password")) {
        toastTitle = "Invalid password. Please try again.";
      } else if (error.message.includes("allowlist")) {
        toastTitle = error.message;
      } else {
        toastTitle =
          flow === "signIn"
            ? "Could not sign in, did you mean to sign up?"
            : "Could not sign up, did you mean to sign in?";
      }
      toast.error(toastTitle);
      setSubmitting(false);
    }
  };

  if (flow === "reset") {
    return (
      <div className="w-full">
        <PasswordResetForm />
        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400 mt-4">
          <button
            type="button"
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium cursor-pointer"
            onClick={() => setFlow("signIn")}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Password"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          <button
            type="button"
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium cursor-pointer"
            onClick={() => setFlow("reset")}
          >
            Forgot password?
          </button>
        </div>
        <div className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
    </div>
  );
}
