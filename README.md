# 🎧 DROP IT | Rhythm & Voice Studio

Welcome to the **Drop It** codebase! This is a high-performance, minimalist DAW (Digital Audio Workstation) built for the web.

## 🚀 The Tech Stack
- **Framework:** Next.js (App Router)
- **UI:** React + Tailwind CSS + ShadCN
- **Icons:** Lucide React
- **Audio Engine:** Web Audio API (Native Browser Audio)
- **Database:** LocalStorage (Client-side persistence)

## 🏗️ How it Works (The Teenager's Guide)

### 1. The UI (React)
Everything you see—the sliders, the glowing grid, the dancing monsters—is built with **React**. It handles the "state," which is just a fancy way of saying it remembers which buttons you've clicked and how high your volume is set.

### 2. The Sound Engine (Web Audio API)
This isn't just a simple music player. Inside `src/components/studio/rhythm-grid.tsx`, we build an **Audio Graph**. When a sound plays, it's routed through a chain:
`Sample` -> `Pitch Shifter` -> `Low-pass Filter` -> `Volume Knob` -> `Stereo Panner` -> `Your Speakers`.

### 3. The Sequencer
The grid is a 16-to-64 step loop. We use a high-precision `setInterval` that tracks the "current step" based on the BPM. If a box is checked, the engine triggers the audio chain for that specific track.

### 4. Saving & Loading
We use `localStorage` to keep your beats safe. When you save, we turn your grid and mixer settings into a JSON object and store it in your browser's "junk drawer" (local storage).

### 5. Exporting
The **Export to Audio** feature uses an `OfflineAudioContext`. It basically "re-records" your entire beat in the background at 10x speed, mixes all the channels down, and spits out a `.wav` file you can share.

## 🛠️ Getting Started
1. Create a profile on the landing page.
2. Record a sound or upload a sample.
3. Click the grid to start making a beat!
4. Open the **Mixer** (sliders icon) to tweak the vibe.
