# 🎧 DROP IT | Rhythm & Voice Studio

Welcome to **Drop It**. This is a functional, browser-based workstation designed for high-performance rhythm creation and audio manipulation using the Web Audio API.

---

## 🚀 The Reality Check
**DROP IT** is a web workstation for rhythm architecture. It uses standard browser technologies to provide a high-precision audio experience without the marketing fluff.

- **Look-Ahead Scheduling:** A robust engine built on the Web Audio API clock for stable BPM performance.
- **Waveform & ADSR Editor:** Visual tools for volume envelopes and sample trimming.
- **WAV Export:** Direct-to-browser audio rendering for 16-bit PCM files.
- **Portable JSON Projects:** Save and load complete session configurations as standard JSON files.
- **Grid Utilities:** Algorithmic tools for pattern randomization, shifting, and mirroring.

---

## ✨ Features
**features:** ["Sample-Accurate Look-Ahead Engine", "Waveform & ADSR Editor", "High-Fidelity WAV Export", "Portable Project JSON Export", "Pattern Generation Tools", "High-Gain Sample Recorder"]

---

## 🏗️ Technical Architecture

### 1. Audio Engine (`src/components/studio/rhythm-grid.tsx`)
The workstation utilizes the Web Audio API to manage a dynamic node-graph.

#### Logic:
- **Scheduler:** Uses a look-ahead algorithm that schedules `AudioBufferSourceNodes` using the `AudioContext.currentTime` clock. This ensures BPM stability even under UI thread load.
- **Signal Chain:** Every channel operates on a dedicated chain:
  `Source` -> `BiquadFilter` -> `WaveShaper` -> `GainNode` (Envelope) -> `StereoPanner` -> `Master`.
- **Master Export:** Uses `OfflineAudioContext` to render the arrangement into a high-fidelity buffer, encoded into a WAV file via a custom PCM implementation.

### 2. Persistence Layer (`src/lib/db.ts`)
The application uses `localStorage` for project persistence.
- **Audio Storage:** Recordings and uploads are stored as Base64 Data URIs.
- **Project Portability:** Projects are bundled into JSON configurations that include all metadata, sequencer data, and raw audio samples for portability.

---

## 🛠️ Getting Started
1. Set up a user profile.
2. Record or upload your samples.
3. Map samples to the 16/32/64-step sequencer.
4. Adjust volume, pitch, and envelopes in the Sample Editor.
5. Export your track as a high-fidelity WAV file.