# 🎧 DROP IT | Rhythm & Voice Studio

Welcome to the **Drop It** codebase! This is a high-performance, minimalist DAW (Digital Audio Workstation) built for the web.

## 🚀 The Tech Stack
- **Framework:** Next.js (App Router)
- **UI:** React + Tailwind CSS + ShadCN
- **Icons:** Lucide React
- **Audio Engine:** Web Audio API (Native Browser Audio)
- **Database:** LocalStorage (Client-side persistence)

## 🏗️ Technical Architecture (Deep Dive)

### 1. Persistence Layer (`src/lib/db.ts`)
The application uses a "Mock-DB" pattern leveraging `localStorage`.
- **Base64 Storage:** Audio clips are stored as Data URIs. This allows for offline-first audio persistence without complex cloud storage.
- **Relational Mapping:** Tracks reference Clip IDs, which are resolved during the studio session.

### 2. The Sound Engine (`src/components/studio/rhythm-grid.tsx`)
The engine is built on the **Web Audio API** node-graph architecture.

#### Key Functions:
- `initAudioContext()`: Safely initializes the `AudioContext` after a user gesture to bypass browser autoplay restrictions.
- `loadAudio(clip)`: Decodes Base64 strings into `AudioBuffers`. These are kept in `audioBuffersRef` to prevent redundant decoding and ensure zero-latency triggering.
- `playClip(clipId, channelSettings)`: Dynamically constructs an audio routing graph:
  `BufferSourceNode` -> `BiquadFilterNode` (Low-pass) -> `GainNode` (Volume) -> `StereoPannerNode` -> `AudioDestination`.
- `exportToAudio()`: Uses `OfflineAudioContext` for high-speed, non-real-time rendering. It iterates through the sequencer grid, schedules all `BufferSourceNodes`, and encodes the result into a 16-bit PCM `.wav` file.

### 3. The Sequencer Loop
The timing is handled by a standard `setInterval` loop. While `setInterval` can drift, we mitigate this by calculating the `stepDuration` based on the project BPM: `(60 / BPM) / 4`. Every tick triggers the `playClip` function for any active cells in the current step index.

### 4. Audio Capture (`src/components/studio/voice-recorder.tsx`)
Uses the `MediaRecorder` API. 
- **Workflow:** `Stream` -> `Blob` -> `ArrayBuffer` -> `Base64`.
- Recorded audio is immediately available for the sequencer once the user "commits" the recording.

## 🛠️ Getting Started
1. Create a profile on the landing page.
2. Record a sound or upload a sample.
3. Click the grid to start making a beat!
4. Open the **Mixer** (sliders icon) to tweak the vibe.
5. Hit the **Download** icon to export your masterpiece as a WAV.
