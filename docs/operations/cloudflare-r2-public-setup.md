# Cloudflare R2 setup (private and public buckets)

**Status:** Current (setup guide). It describes the intended layout. It is not proof of live state.
**Owner:** Kanvise engineering
**Last verified:** 2026-11-26 against `api/src/storage/r2.ts`, `api/src/routes/storage.ts` and `api/.env.example`. Anything about the Cloudflare account, buckets or domains is **unverified** because it cannot be checked from the repository.

## Decision

Use separate private and public R2 buckets. Connecting an R2 custom domain makes the whole bucket publicly readable, so a `/public/` key prefix does not protect private objects stored in the same bucket.

| Purpose | Bucket (development) | Access |
|---|---|---|
| Notes, assignment attachments, submissions, recordings | `kanvise` | Private; presigned access only |
| Branding, programme thumbnails, promo images, profile photos, class slides | `kanvise-public-dev` | Public through a CDN domain |

The planned production layout is `kanvise-private-production` (no public domain) and `kanvise-public-production` served from `cdn.kanvise.com`. These names are plans. A comment in `api/src/storage/r2.ts` (dated 2026-07-26) records that production then reused the development credentials, the shared `kanvise` bucket and `kanvise-public-dev` through `r2.dev`. Whether that has changed is **unverified** (DEV-INT-007, DEV-UPL-014).

## API variables

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=            # private bucket
R2_PUBLIC_BUCKET_NAME=     # public bucket
R2_PUBLIC_BASE_URL=        # for example https://cdn-dev.kanvise.com
```

Private storage needs the first four. Public presigning also needs the last two. Never commit values. Use a scoped R2 API token with read, write and delete on both buckets, not root account credentials. Restart the API after changing its environment.

## Setup checklist (development)

1. In Cloudflare, open **R2 Object Storage** and create `kanvise-public-dev`.
2. Leave `kanvise` private.
3. Open `kanvise-public-dev` → **Settings** → **Custom Domains** → **Add**, connect `cdn-dev.kanvise.com` and wait until it is active. The custom domain is the CDN delivery URL.
4. Keep the Cloudflare-managed `r2.dev` URL disabled.
5. Configure CORS on both buckets for the exact frontend origins. Allow `GET`, `HEAD` and `PUT`, allow the `Content-Type` header and expose `ETag`. Add staging and production origins only when they exist. A bucket with no CORS policy fails browser preflight with HTTP 403.
6. Set the variables above.

## Routes that use the buckets

Defined in `api/src/routes/storage.ts`:

- `POST /storage/presign/upload` and `GET /storage/presign/download` for private files (the older `/storage/presigned-url` aliases remain).
- `POST /storage/presign/public` and `POST /storage/public/confirm` for public media. The confirm step verifies the uploaded object before its URL or key is saved.

## Verification checklist

- Upload a disposable public image through the presigned public route, confirm it, and check that the permanent CDN URL returns the object.
- Replace it and confirm the former R2 object is deleted.
- Convert a disposable class PDF and check that all slide URLs use the CDN host.
- Force a failed slide finalisation and confirm partial objects are cleaned.
- Confirm private objects cannot be fetched through the public domain.
- Confirm the `r2.dev` endpoint stays disabled.

Do not run public-media live tests until both public variables and the custom domain are configured. No staging or production run of this checklist is recorded in the repository (DEV-TRK-013-01).
