# Tool Portal

## Setup

```bash
npm install
npm run dev
```

## Deploy (Vercel)

- Import this folder in Vercel
- Framework Preset: Next.js
- Add Postgres integration in Vercel Storage (recommended), then redeploy
- Required env vars for `@vercel/postgres`:
  - `POSTGRES_URL`
  - `POSTGRES_PRISMA_URL`
  - `POSTGRES_URL_NON_POOLING`
  - `POSTGRES_USER`
  - `POSTGRES_HOST`
  - `POSTGRES_PASSWORD`
  - `POSTGRES_DATABASE`
- Optional env var: `NEXT_PUBLIC_SITE_URL`

## Review page

- URL: `/review`
