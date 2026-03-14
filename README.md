# Edit Workspace

Top-level layout:

- `Web-App`
  - `Web-App/dashboard`: Web frontend (Vite + React)
  - `Web-App/server`: Web backend (Node + Express)
- `Desktop-Software`
  - Reserved area for desktop shell (Electron/Tauri)
- `IOS_App`
  - iOS native wrapper (Capacitor)
- `Google-App`
  - Android native wrapper (Capacitor)
- `Brand`
  - Brand/media assets
- `Rest`
  - Runtime support, docs, scripts, and legacy material

Support folders:

- `Rest/scripts`: automation scripts (smoke, checks, ops)
- `Rest/docs`: architecture and status/checklists
- `Rest/archive`: legacy or non-runtime files
- `Rest/mobile-workspace`: Capacitor workspace glue for iOS/Android sync

## Common Commands (from repo root)

- `npm run dev`: web server + web dashboard
- `npm run build`: production web build
- `npm run start`: start web backend
- `npm run mobile:sync`: build web and sync into native mobile projects
- `npm run mobile:ios`: open iOS project in Xcode
- `npm run mobile:android`: open Android project in Android Studio
