# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Mobile App — Tabbakheen Food Market (`artifacts/mobile`)

- **Framework**: Expo (React Native) with expo-router
- **Source**: Cloned from https://github.com/deadevil2002/tabbakheen-web2.git
- **Package manager**: pnpm
- **Dev command**: `pnpm --filter @workspace/mobile run dev`
- **Backend**: Firebase (Firestore + Auth) via `EXPO_PUBLIC_FIREBASE_*` env vars
- **Key dependencies**: firebase, zustand, lucide-react-native, expo-notifications, expo-clipboard, react-native-maps@1.18.0

### App Structure

```
artifacts/mobile/
├── app/             # Expo Router routes
│   ├── index.tsx    # Root entry (routes by role)
│   ├── auth/        # Login, Register, Forgot Password
│   ├── (customer)/  # Customer tabs: home, map, orders, profile
│   ├── (provider)/  # Provider tabs: dashboard, my-offers, my-orders, settings
│   └── (driver)/    # Driver tabs: dashboard, deliveries, my-deliveries, profile
├── components/      # Shared UI components
├── contexts/        # Auth, Data, Locale React contexts
├── services/        # Firebase, Firestore, notifications, etc.
├── constants/       # Colors, i18n strings, shared styles
├── types/           # TypeScript type definitions
└── utils/           # Auth guard, account gating, helpers
```

### Required Environment Variables

Set these for Firebase to work:
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_APP_ID`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- (Other Firebase vars have defaults for the `tabbakheen-99883` project)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/mobile run dev` — run Expo mobile app

## Minimal Fixes Applied During Setup

1. `metro.config.js` — added web resolver to shim `react-native-maps` on web (it's native-only)
2. `shims/react-native-maps.web.js` — web stub for `react-native-maps`
3. `app.json` — updated plugins to include `expo-notifications`, corrected splash image path
4. `constants/colors.ts`, `constants/i18n.ts`, `constants/sharedStyles.ts` — copied from repo (replaced scaffold defaults)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
