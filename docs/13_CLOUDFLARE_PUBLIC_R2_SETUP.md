# Cloudflare Public R2 Setup

## Decision

Use separate private and public R2 buckets. Connecting an R2 custom domain makes
the connected bucket publicly readable, so a `/public/` key prefix does not
protect private objects stored in the same bucket.

Current development layout:

| Purpose | Bucket | Access |
|---|---|---|
| Notes, assignments, submissions | `kanvise` | Private; presigned access only |
| Branding, programme thumbnails, promos, profile photos, class slides | `kanvise-public-dev` | Public through CDN |

Future production layout:

| Purpose | Bucket | Domain |
|---|---|---|
| Private production files | `kanvise-private-production` | No public domain |
| Public production media | `kanvise-public-production` | `cdn.kanvise.com` |

Development and production are separated to prevent test uploads, cleanup,
CORS rules, and credentials from affecting real users. Only the development
public bucket needs to be created now.

## Development setup checklist

1. In Cloudflare, open **R2 Object Storage** and create
   `kanvise-public-dev`.
2. Leave the existing `kanvise` bucket private.
3. Open `kanvise-public-dev` → **Settings** → **Custom Domains** → **Add**.
4. Connect `cdn-dev.kanvise.com` and wait for its status to become active.
   The custom domain is the CDN delivery URL; it is not an alternative to CDN.
5. Keep the bucket's Cloudflare-managed `r2.dev` development URL disabled.
6. Configure CORS on `kanvise-public-dev` for the exact development frontend
   origins. Allow `GET`, `HEAD`, and `PUT`, allow the `Content-Type` header, and
   expose `ETag`. Add staging and production origins only when they exist.
7. Ensure the R2 API token used by Hono can read, write, and delete objects in
   both `kanvise` and `kanvise-public-dev`. Do not use root account credentials.
8. Add the following API environment values without committing their values:

   ```env
   R2_PUBLIC_BUCKET_NAME=kanvise-public-dev
   R2_PUBLIC_BASE_URL=https://cdn-dev.kanvise.com
   ```

9. Restart the API after changing its environment.

## Verification checklist

- Upload a disposable public image through the presigned public-upload route.
- Confirm it and verify the permanent CDN URL returns the expected object.
- Replace it and confirm the former R2 object is deleted.
- Convert a disposable class PDF and verify all slide URLs use
  `cdn-dev.kanvise.com`.
- Force a failed slide finalization and confirm partial objects are cleaned.
- Confirm notes, assignments, and submissions in `kanvise` cannot be retrieved
  through the public domain.
- Confirm the `r2.dev` endpoint remains disabled.

Do not run public-media live tests until both public environment variables and
the custom domain are configured.
