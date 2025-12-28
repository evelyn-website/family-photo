# Production Deployment Guide

This guide covers deploying the Family Photo application to production with a custom domain.

## Prerequisites

- Convex account and project set up
- Vercel account (or alternative hosting service)
- Custom domain purchased
- Resend account for email (password reset functionality)

## Step 1: Deploy Convex Backend

### 1.1 Create Production Deployment

```bash
npx convex deploy -y
```

This creates a production deployment. **Save the production URL** (e.g., `https://your-project.convex.cloud`) - you'll need it for frontend configuration.

### 1.2 Set Environment Variables in Convex Dashboard

Go to [Convex Dashboard](https://dashboard.convex.dev) → Your Production Deployment → Settings → Environment Variables

Set these variables:

- **AUTH_RESEND_KEY**: Your Resend API key
- **AUTH_RESEND_FROM_EMAIL**: `"Family Photo <noreply@yourdomain.com>"` (use your verified domain email)
- **JWT_PRIVATE_KEY**: Copy from your dev deployment (or generate new keys)
- **JWKS**: Copy from your dev deployment (or generate new keys)

**Note**: `CONVEX_SITE_URL` is automatically set by Convex and cannot be manually configured. The `auth.config.ts` file uses `process.env.CONVEX_SITE_URL` which is correct.

### 1.3 Verify Configuration

Ensure `convex/auth.config.ts` uses:

```typescript
domain: process.env.CONVEX_SITE_URL,
```

This ensures auth redirects work correctly with Convex's HTTP Actions URL.

## Step 2: Deploy Frontend to Vercel

### 2.1 Create Vercel Configuration

Ensure `vercel.json` exists in project root:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 2.2 Deploy via Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your repository
4. Configure build settings:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. **Environment Variables**:
   - Add: `VITE_CONVEX_URL` = Your Convex production URL from Step 1.1
6. Click "Deploy"

### 2.3 Or Deploy via CLI

```bash
npm i -g vercel
vercel --prod
```

Then add environment variable in Vercel dashboard:

- `VITE_CONVEX_URL` = Your Convex production URL

## Step 3: Configure Custom Domain

### 3.1 Add Domain in Vercel

1. In Vercel dashboard → Your Project → Settings → Domains
2. Click "Add Domain"
3. Enter your custom domain (e.g., `yourdomain.com`)
4. Vercel will show DNS configuration instructions

### 3.2 Configure DNS at Domain Registrar

1. Log into your domain registrar
2. Find DNS management section
3. Add the DNS records shown by Vercel:
   - Usually: **A record** `@` → Vercel's IP address (shown in dashboard)
   - Or: **CNAME** `www` → `cname.vercel-dns.com` (for www subdomain)
4. Save changes

**Note**: DNS propagation can take 1-48 hours (usually 1-2 hours). Vercel will automatically provision SSL certificate once DNS is verified.

## Step 4: Verify Domain in Resend

To send emails from your custom domain:

1. Go to [Resend Dashboard](https://resend.com/domains)
2. Click "Add Domain"
3. Enter your domain
4. Follow DNS verification steps:
   - Add TXT record shown in Resend dashboard to your domain registrar
   - Add SPF/DKIM records if required
5. Wait for verification (usually a few minutes)
6. Update `AUTH_RESEND_FROM_EMAIL` in Convex to use your verified domain email (e.g., `noreply@yourdomain.com`)

## Step 5: Testing & Verification

After DNS propagation, test:

- [ ] Visit your custom domain - app loads correctly
- [ ] Check browser console - no errors
- [ ] Verify HTTPS is active (lock icon in browser)
- [ ] Test sign-up with allowlisted email
- [ ] Test password reset - email arrives from your domain
- [ ] Sign in as admin - admin panel accessible
- [ ] Test photo upload functionality
- [ ] Test collections and editorial features
- [ ] Test navigation (all routes work correctly)

## Troubleshooting

### Convex Deployment Fails

**Error: "AUTH_RESEND_KEY not set"**

- Set all required environment variables in Convex dashboard before deploying
- Ensure variables are set for the correct deployment (production)

**Error: "JWT_PRIVATE_KEY not set"**

- Copy `JWT_PRIVATE_KEY` and `JWKS` from dev deployment to production
- Or generate new keys if you want separate keys for dev/prod

### Domain Not Working

**Domain shows "Not configured"**

- Verify DNS records match Vercel's instructions exactly
- Wait for DNS propagation (can take up to 48 hours)
- Check domain is added in Vercel dashboard → Domains

**Site loads but authentication fails**

- Ensure `auth.config.ts` uses `process.env.CONVEX_SITE_URL` (not hardcoded domain)
- Verify `VITE_CONVEX_URL` in Vercel points to production Convex URL
- Check browser console for specific errors

### Email Not Sending

**Password reset emails not arriving**

- Verify domain is verified in Resend dashboard
- Check `AUTH_RESEND_FROM_EMAIL` uses verified domain email format
- Verify Resend DNS records are correct at domain registrar

### Authentication Errors

**"Not authenticated" error after sign-up**

- This is handled by retry logic in `SignInForm.tsx`
- If persistent, check that `JWT_PRIVATE_KEY` and `JWKS` are set in production

## Environment Variables Summary

### Convex Production Deployment

- `AUTH_RESEND_KEY`: Resend API key
- `AUTH_RESEND_FROM_EMAIL`: Verified domain email (e.g., `"Family Photo <noreply@yourdomain.com>"`)
- `JWT_PRIVATE_KEY`: JWT private key (copy from dev or generate new)
- `JWKS`: JSON Web Key Set (copy from dev or generate new)
- `CONVEX_SITE_URL`: Automatically set by Convex (do not override)

### Vercel Frontend

- `VITE_CONVEX_URL`: Convex production deployment URL

## Important Notes

- **Separate deployments**: Dev and production Convex deployments are separate - changes to dev don't affect production
- **Environment variables**: Never commit `.env` files - set them in Vercel and Convex dashboards
- **Domain email**: You'll need to verify your domain in Resend to send emails from it
- **Testing**: Test thoroughly before inviting users to production
- **SSL/HTTPS**: Automatically provisioned by Vercel once DNS is configured

## Cost Breakdown

**Total monthly cost: $0** (free tier for everything)

- Convex: Free tier (generous limits)
- Vercel: Free tier (100GB bandwidth/month)
- Resend: Free tier (3,000 emails/month)
- SSL/HTTPS: Included free with Vercel
