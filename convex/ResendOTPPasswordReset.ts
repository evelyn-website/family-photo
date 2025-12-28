import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };

    const alphabet = "0123456789";
    const length = 8;
    return generateRandomString(random, alphabet, length);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    const fromEmail =
      process.env.AUTH_RESEND_FROM_EMAIL ||
      "Family Photo <onboarding@resend.dev>";
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [email],
      subject: `Reset your password in Family Photo`,
      text: `Your password reset code is ${token}`,
    });

    if (error) {
      throw new Error("Could not send password reset email");
    }
  },
});
