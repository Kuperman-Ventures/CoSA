# CoSA Platform Setup Checklist

Use this checklist in order. I already prepared the codebase for these steps.

## 1) GitHub

1. Create a new GitHub repository:
   - Name: `CoSA`
   - Visibility: your choice (private recommended)
2. In your local project folder (`/Users/thor/WEB APP PROJECTS/CoSA`), run:
   - `git init`
   - `git add .`
   - `git commit -m "Initialize CoSA Phase 1 Today screen and timer logic"`
   - `git branch -M main`
   - `git remote add origin <YOUR_GITHUB_REPO_URL>`
   - `git push -u origin main`

## 2) Supabase (new project)

1. Create project in Supabase:
   - Project name: `CoSA`
   - Database password: store safely
   - Region: closest to your location
2. In Supabase SQL Editor, run the full file:
   - `supabase/schema.sql`
3. Enable Google auth:
   - Auth -> Providers -> Google -> Enable
   - Add Google OAuth client ID and secret (from Google Cloud Console)
4. Auth redirect URLs:
   - Add local URL: `http://localhost:5173`
   - Add Vercel URL after deploy: `https://<your-vercel-domain>`
5. In Supabase project settings, copy:
   - Project URL
   - Anon public key
6. Create local env file:
   - `cp .env.example .env.local`
   - Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

## 3) Vercel (new project)

1. Create/import project from GitHub repo `CoSA`.
2. Framework preset should auto-detect as `Vite`.
3. Build settings (if needed):
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Environment variables in Vercel Project Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.
6. Copy production URL and add it to Supabase Auth redirect URLs.

## 4) Verify Phase 1

1. Open app locally (`npm run dev`) and in Vercel production.
2. Test timer state transitions:
   - Not Started -> Running -> Paused -> Running -> Completed
   - Not Started -> Running -> Cancelled
   - Running -> Overrun (let timer hit zero)
3. Confirm:
   - Overrun prompt appears.
   - Done + Outcome tasks require yes/no outcome selection.
   - Ventures/Encore task enforces 10+ word definition of done before start.

## 5) Next Build Target

Proceed to Phase 2 after Phase 1 validation:

- Task Library (all nine editable fields + non-retroactive deployments).
