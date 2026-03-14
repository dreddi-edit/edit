# Edit Workspace

Clean monorepo layout:

- `apps/web`
  - `apps/web/dashboard`: Web frontend (Vite + React)
  - `apps/web/server`: Web backend (Node + Express)
- `apps/mobile`
  - `apps/mobile/ios`: iOS native wrapper (Capacitor)
  - `apps/mobile/android`: Android native wrapper (Capacitor)
- `apps/desktop`
  - Reserved area for desktop app shell

Support folders:

- `scripts`: root automation scripts (smoke, checks, ops)
- `docs`: architecture and status/checklists
- `assets`: brand/media assets
- `archive`: legacy or non-runtime files

## Common Commands (from repo root)

- `npm run dev`: web server + web dashboard
- `npm run build`: production web build
- `npm run start`: start web backend
- `npm run mobile:sync`: build web and sync into native mobile projects
- `npm run mobile:ios`: open iOS project in Xcode
- `npm run mobile:android`: open Android project in Android Studio
