@AGENTS.md

# Deccan Bawarchi — Claude Code Guide

## What this is
Full-stack restaurant ordering website for Deccan Bawarchi, an authentic Hyderabadi cuisine restaurant in Northville, MI. Built with **Expo SDK 56 + React Native Web** — **web is the launch target** (Firebase Hosting). iOS/Android are not in scope for launch; the codebase still uses Expo/RN primitives that compile to the browser.

## Tech Stack
- **Expo SDK 56** + **Expo Router** (file-based routing, `app/` directory)
- **Firebase**: Auth, Firestore, Storage, Cloud Functions, Hosting, FCM
- **Zustand** for cart/auth/order/notification state
- **TanStack Query** for server state & caching
- **Stripe** payments (via Firebase Extension)
- **DoorDash Drive** white-label delivery
- **NativeWind** (Tailwind) + custom theme (`constants/theme.ts`)
- **Design**: Midnight Gold — `#0b0905` bg, `#d4af37` gold, Playfair Display / Cinzel fonts

## Key Invariants
- All money stored as **integers in cents** in Firestore; displayed as formatted dollars in UI
- Loyalty points awarded **server-side only** in Cloud Function on `status === 'delivered'`
- All Firestore writes involving money use **transactions**
- Stripe and DoorDash secrets **never** in client code — Cloud Functions only
- Buffet timing computed in **America/Detroit** timezone using `date-fns-tz`
- `isWeekend` = Saturday only (Sunday is closed); Saturday buffet = $24.99, Mon–Fri = $17.99
- Auth prompt appears only at checkout, never blocks browsing or cart

## Important Files
- `constants/theme.ts` — all colors, spacing, fonts, border radius
- `constants/buffet.ts` — `BUFFET_PRICING`, `BUFFET_HOURS`, `BUFFET_DAYS`
- `constants/config.ts` — business hours, loyalty config, default location
- `lib/firebase.ts` — Firebase init (Auth, Firestore, Storage)
- `hooks/useBuffet.ts` — live Firestore listener + Detroit timezone logic
- `store/cartStore.ts` — cart (items, promo, loyalty, gift card, tip)
- `store/authStore.ts` — Firebase user + profile + admin flag
- `firestore.rules` — security rules

## Entry Point
`main` in `package.json` is `expo-router/entry`. Screens live in `app/`.

## Running Locally
```bash
npm run web
npm run build

cd functions && npm install && npm run serve
```

## Deploy Web
Run these as **separate commands** (do not paste inline `#` comments on the same line):

```bash
npm run build
firebase deploy --only hosting
```

## Seeding Firestore
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
npm run seed
```
