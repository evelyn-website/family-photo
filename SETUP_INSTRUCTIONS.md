# Invite-Only Site Setup Instructions

This document provides instructions for setting up the invite-only access system with admin and allowlist functionality.

## Initial Setup Steps

### 1. Configure Email Service (Password Reset)

Password reset functionality requires a Resend API key and "from" email address:

1. Sign up for a Resend account at https://resend.com
2. Create an API key in your Resend dashboard
3. Add the following environment variables to your Convex dashboard:
   - Go to your Convex dashboard
   - Navigate to Settings → Environment Variables
   - Add `AUTH_RESEND_KEY` with your Resend API key value
   - Add `AUTH_RESEND_FROM_EMAIL` with your "from" email address (e.g., `"Family Photo <noreply@yourdomain.com>"` or `"onboarding@resend.dev"` for testing)

**Note**: You'll need to verify your domain in Resend to send emails from a custom domain. For testing, you can use `onboarding@resend.dev`. If `AUTH_RESEND_FROM_EMAIL` is not set, it defaults to `"Family Photo <onboarding@resend.dev>"`.

### 2. Deploy Schema Changes

The schema has been updated with:

- `allowedEmails` table for managing the email allowlist
- `isAdmin` field added to `profiles` table

Deploy these changes to your Convex backend.

### 3. Add Initial Allowlist Entry

You need to manually add the initial admin email to the allowlist. You can do this via:

**Option A: Convex Dashboard**

1. Go to your Convex dashboard
2. Navigate to the Data section
3. Select the `allowedEmails` table
4. Click "Add Document"
5. Add a document with:
   - `email`: `evelynnelson000@gmail.com` (normalized to lowercase)
   - `addedBy`: You'll need to use a user ID (can be temporary, will be updated after first sign-in)
   - `addedAt`: Current timestamp (number)

**Option B: Convex Functions (Recommended)**

1. Temporarily modify `convex/allowlist.ts` to allow unauthenticated access for initial setup
2. Or use the Convex dashboard's function runner to call `addEmail` mutation
3. After adding the initial email, restore authentication requirements

### 4. Sign Up as Admin

1. Navigate to the sign-up page
2. Sign up with email: `evelynnelson000@gmail.com`
3. The system will automatically:
   - Validate your email is on the allowlist
   - Set your admin status to `true` (because your email matches the admin email list)
   - Create your profile with `isAdmin: true`

### 5. Verify Admin Access

1. After signing up, you should see the "Admin" link in the navigation
2. Click on "Admin" to access the Admin Panel
3. You should see:
   - Email Allowlist management section
   - Admin Management section
   - Editorial Period management (existing feature)

## Admin Email Configuration

The admin email is configured in `convex/admins.ts`:

```typescript
const ADMIN_EMAILS = ["evelynnelson000@gmail.com"];
```

Users with emails in this list will automatically become admins when they sign up.

## Adding More Admins

After the initial setup, you can add more admins through the Admin Panel:

1. Sign in as an admin
2. Go to Admin Panel
3. Navigate to "Admin Management" section
4. Add admins by:
   - **Email**: Enter the user's email address (they must already be on the allowlist)
   - **User ID**: Enter an existing user's ID

## Adding Users to Allowlist

1. Sign in as an admin
2. Go to Admin Panel
3. Navigate to "Email Allowlist" section
4. Enter an email address and click "Add Email"
5. The user can now sign up or sign in with that email

## Security Notes

- **Admins cannot remove themselves**: This prevents accidental lockout
- **Admins cannot remove their own email from allowlist**: This prevents accidental lockout
- **All mutations verify admin status server-side**: UI hiding is not sufficient security
- **Email validation happens both client-side and server-side**: Client-side for UX, server-side for security

## Password Reset

Users can reset their password using the "Forgot password?" link on the sign-in page:

1. Click "Forgot password?" on the sign-in form
2. Enter your email address
3. Check your email for the 8-digit reset code
4. Enter the code and your new password
5. Sign in with your new password

**Note**: Password reset codes expire after a period of time. If you don't receive the email, check your spam folder or request a new code.

## Troubleshooting

### Password reset email not received

- Verify `AUTH_RESEND_KEY` is set in Convex environment variables
- Check Resend dashboard for email delivery status
- Ensure the email address is correct and on the allowlist
- Check spam/junk folder

### "Access Denied" when accessing Admin Panel

- Verify your profile has `isAdmin: true`
- Check that you signed up with `evelynnelson000@gmail.com` or were added as admin
- Verify the profile was created correctly

### Cannot sign up with allowlisted email

- Verify the email exists in the `allowedEmails` table
- Check that the email is normalized (lowercase, trimmed)
- Ensure the email matches exactly (case-insensitive)

### Admin status not set automatically

- Verify the email matches exactly in `ADMIN_EMAILS` array in `convex/admins.ts`
- Check that `validateUserAfterSignup` mutation ran successfully
- Verify the profile was created/updated with `isAdmin: true`

## Migration from Existing Site

If you have existing users:

1. **Add existing users to allowlist**: Use the Admin Panel to add their emails
2. **Set existing admin**: Use the Admin Panel to promote existing users to admin status
3. **Remove anonymous access**: Anonymous provider has been removed from auth configuration

## Next Steps

After initial setup:

1. Add additional users to the allowlist as needed
2. Promote trusted users to admin status
3. Manage the allowlist through the Admin Panel UI
