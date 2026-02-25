
# 🎧 DROP IT | Rhythm & Voice Studio

Welcome to the **Drop It** codebase! This is a high-performance, minimalist DAW (Digital Audio Workstation) built for the web, designed for professional-grade sonic architecture.

---

## 🚀 The LinkedIn Pitch
**DROP IT** is a professional-grade, web-based workstation designed for high-precision rhythm architecture. It bridges the gap between browser-based accessibility and studio-grade performance.

- **Sample-Accurate Scheduling:** A "Look-Ahead" engine built on the Web Audio API clock for rock-solid BPM stability.
- **Surgical Sampler Lab:** Kinetic visualizers for ADSR envelopes and waveform trimming.
- **Mastering & Portability:** High-fidelity WAV export and portable JSON project configurations.
- **Minimalist UI:** A high-intensity, "Neural" workspace for zero-friction production.

---

## ✨ Features
**features:** ["Sample-Accurate Look-Ahead Engine", "Surgical Sampler Visualizer", "High-Fidelity WAV Mastering", "Portable Project JSON Export", "Algorithmic Rhythm Workbench", "Neural Signal Capture"]

---

## 🏗️ Technical Architecture (Deep Dive)

### 1. The Sound Engine (`src/components/studio/rhythm-grid.tsx`)
The engine is built on a professional Web Audio API node-graph architecture.

#### Key Modules:
- **Sample-Accurate Scheduler:** Uses a "Look-Ahead" algorithm. It schedules `AudioBufferSourceNodes` using the `AudioContext.currentTime` clock approximately 100ms in advance, ensuring rock-solid BPM stability even under UI load.
- **Surgical Sampler Lab:** Every channel features a dedicated signal chain:
  `Source` -> `BiquadFilter` (Cutoff) -> `WaveShaper` (Distortion) -> `GainNode` (ADSR Envelope) -> `StereoPanner` -> `DelayNode` (Spatial FX) -> `Master Bus`.
- **Visual ADSR & Trim:** Real-time SVG rendering of volume envelopes and waveform slice points for intuitive sound design.
- **High-Fidelity Master Export:** Utilizes an `OfflineAudioContext` to render the entire arrangement into a buffer, which is then encoded into a 16-bit PCM `.wav` file for download.

### 2. Persistence Layer (`src/lib/db.ts`)
The application uses a "Mock-DB" pattern leveraging `localStorage`.
- **Base64 Storage:** Audio clips are stored as Data URIs. This allows for offline-first audio persistence without complex cloud storage.
- **Project Portability:** Projects can be exported and imported as JSON configuration files, bundling metadata, sequencer grids, and raw audio data.

### 3. Pattern Workbench
Replaces traditional AI with algorithmic rhythm tools:
- **Randomize:** Generates rhythmic patterns based on user-defined instrument streams.
- **Nudge (Shift):** Shifts grid data forward or backward for micro-timing and syncopation.
- **Mirroring:** Instantly clones half-patterns to create consistent 16/32 step loops.

---

## 🛠️ Getting Started
1. Create a profile on the landing page.
2. Record a sound or upload a sample.
3. Use the **Pattern Workbench** (Dices/Arrows) to quickly generate a groove.
4. Open the **Sampler Lab** (sliders icon) to surgically edit your sounds visually.
5. Hit the **Download** icon to master your track as a WAV or the **FileDown** icon to save your project config.
