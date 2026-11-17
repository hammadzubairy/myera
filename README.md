# My Era

Member companion app for My Era Rx — Expo (iOS/Android), Node API, React admin stub, Supabase, Cloudinary.

## Day 1 scope

- Auth: email, Google, Apple, password reset
- Profile onboarding (name, photo, height, weight, goal, gender → community; Non-binary/Other pick community)
- Dose regimens, changes, history, logs
- Weight logs + chart (1M / 2M / All) with dose markers
- Measurements (waist, hips, custom)
- Today screen (live progress + dose; food/community stubs)
- Push notification foundation (permission + token registration)

## Structure

```
apps/mobile   Expo Router app
apps/api      Express + Supabase service role
apps/admin    Vite React stub
packages/shared  Types, zod schemas, brand tokens
supabase/migrations  SQL + RLS
reference/    FRS + design HTML
```

## Setup

1. Copy `.env.example` to `.env` and fill Supabase + Cloudinary values. Also set `EXPO_PUBLIC_*` for the mobile app (or `apps/mobile/.env`).

2. Apply the migration in `supabase/migrations/20261016000000_day1_foundation.sql` via the Supabase SQL editor or CLI.

3. Enable Email, Google, and Apple providers in Supabase Auth. Add redirect URL `myera://`.

4. Install and run:

```bash
npm install
npm run shared:build
npm run api
npm run mobile
# optional
npm run admin
```

## Design

UI tokens and copy match `reference/myera-app-design (3).html` (Deep Teal, Soft Rose Taupe, Lora / Jost / DM Sans).
