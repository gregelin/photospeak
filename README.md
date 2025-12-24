# PhotoSpeak

A native macOS Electron app that lets you browse your Apple Photos library and record voice audio associated with each photo.

## Features

- **Browse Apple Photos** - Access your entire Photos library including albums
- **Thumbnail Grid** - View photos in a responsive grid layout
- **Photo Detail View** - Click to view full-size photos
- **Record Audio** - Record voice memos while viewing a photo
- **Playback** - Play back recorded audio with progress tracking
- **Persistent Storage** - Audio associations are saved and persist across sessions

## Tech Stack

- **Electron** - Native desktop app framework
- **Vue 3** - Frontend framework (Composition API)
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Pinia** - State management
- **Swift** - PhotoKit helper for Apple Photos access

## Architecture

The app uses a Swift CLI helper to access Apple Photos via PhotoKit. Electron spawns this helper and communicates via JSON over stdout/stdin. This approach was chosen because:

1. PhotoKit requires Swift/Objective-C
2. A CLI helper is simpler to build and debug than a native Node addon
3. The helper can be tested independently

```
┌─────────────────┐     JSON/IPC     ┌──────────────────┐
│  Electron App   │ ◄──────────────► │  Swift Helper    │
│  (Vue Frontend) │                  │  (PhotoKit CLI)  │
└─────────────────┘                  └──────────────────┘
```

## Prerequisites

- macOS 13+ (Ventura or later)
- Node.js 18+
- Xcode Command Line Tools (for Swift)

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the Swift helper:**
   ```bash
   cd swift-helper
   swift build -c release
   cd ..
   ```

3. **Grant permissions:**
   - Photos: System Settings → Privacy & Security → Photos → Enable for Terminal/Electron
   - Microphone: Will prompt on first recording

## Development

```bash
npm run dev
```

This starts Vite dev server with hot reload and launches Electron.

## Build

```bash
npm run build
```

Creates a distributable macOS app in the `release/` folder.

## Project Structure

```
photospeak/
├── electron/
│   ├── main.ts           # Electron main process
│   └── preload.ts        # IPC bridge to renderer
├── swift-helper/
│   ├── Package.swift
│   └── Sources/
│       └── PhotoSpeakHelper/
│           └── main.swift    # PhotoKit CLI tool
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── components/
│   │   ├── AlbumList.vue     # Sidebar album navigation
│   │   ├── PhotoGrid.vue     # Thumbnail grid
│   │   ├── PhotoDetail.vue   # Full photo view
│   │   ├── AudioPanel.vue    # Record/playback controls
│   │   └── PermissionError.vue
│   └── stores/
│       └── photos.ts         # Pinia store
├── build/
│   └── entitlements.mac.plist
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## How It Works

### Photos Access
The Swift helper uses PhotoKit to:
- List albums (`list-albums`)
- Fetch photos with thumbnails (`list-photos`)
- Get full-size images (`get-photo`)

Photos are returned as base64-encoded JPEG data.

### Audio Recording
- Uses the browser's MediaRecorder API to capture audio
- Records in WebM format
- Audio files are stored in `~/Library/Application Support/photospeak/audio/`
- Associations (photo ID → audio path) are stored in localStorage

### Security
- Content Security Policy restricts resource loading
- Audio files are loaded via IPC (not file:// URLs) for security
- Photos access requires explicit user permission

## License

MIT
