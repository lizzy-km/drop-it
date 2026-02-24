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
- `initAudioContext()`: Safely initializes the `AudioContext` after a user gesture.
- `loadAudio(clip)`: Decodes Base64 strings into `AudioBuffers`.
- `playClip(clipId, channelSettings)`: Dynamically constructs an audio routing graph:
  `BufferSourceNode` -> `BiquadFilterNode` (Low-pass) -> `GainNode` (Volume) -> `StereoPannerNode` -> `AudioDestination`.
- `exportToAudio()`: Uses `OfflineAudioContext` for high-speed rendering into a `.wav` file.

---

## 🇲🇲 မြန်မာလို ရှင်းလင်းချက် (Step-by-Step Logic)

ဒီ Project ရဲ့ အလုပ်လုပ်ပုံကို အဆင့်ဆင့် ရှင်းပြထားပါတယ်-

### ၁။ အချက်အလက် သိမ်းဆည်းခြင်း (Data Storage)
ကျနော်တို့က Server မသုံးဘဲ Browser ထဲက `localStorage` မှာတင် data သိမ်းတာပါ။ အသံတွေကို စာသား (Base64) အဖြစ် ပြောင်းပြီး သိမ်းတဲ့အတွက် Browser ပိတ်လိုက်ရင်တောင် data မပျောက်ပါဘူး။

### ၂။ အသံဖမ်းခြင်း (Recording)
`navigator.mediaDevices.getUserMedia` ကို သုံးပြီး မိုက်ခရိုဖုန်းကို ဖွင့်ပါတယ်။ အသံဖမ်းပြီးရင် ရလာတဲ့ Audio Blob ကို `FileReader` နဲ့ Base64 ပြောင်းပြီး `db.ts` ထဲမှာ သိမ်းလိုက်ပါတယ်။

### ၃။ အသံ Engine (Web Audio API)
Browser ရဲ့ built-in အသံစနစ်ကို သုံးထားတာပါ။ အသံတစ်ခု ထွက်ဖို့အတွက် ကျနော်တို့က ပိုက်လိုင်း (Nodes) တွေ ဆက်ပေးရပါတယ်။
- **Chain:** `Source` (အသံ) -> `Filter` (အသံအုပ်) -> `Gain` (အသံအတိုးအကျယ်) -> `Panner` (ဘယ်/ညာ) -> `Speakers` (စပီကာ)။

### ၄။ စည်းချက် ထိန်းညှိခြင်း (Sequencer)
`setInterval` ကို သုံးပြီး BPM အလိုက် အချိန်ကို တွက်ပါတယ်။ ဥပမာ- BPM 120 ဆိုရင် တစ်ကွက်ကို `0.125` စက္ကန့်တိုင်း ရွေ့ပါတယ်။ အကွက်ရောက်တိုင်းမှာ သတ်မှတ်ထားတဲ့ အသံတွေကို Audio Engine ကနေ တပြိုင်နက်တည်း လွှတ်ပေးပါတယ်။

### ၅။ အသံဖိုင် ထုတ်ယူခြင်း (Exporting)
သီချင်းပြီးရင် `OfflineAudioContext` ကို သုံးပြီး နောက်ကွယ်မှာ အသံဖမ်းပါတယ်။ ပြီးရင် raw audio data တွေကို `.wav` format ဖြစ်အောင် binary code တွေ ထည့်ပေးပြီး ဖုန်းထဲကို download ဆွဲလို့ရအောင် လုပ်ပေးတာပါ။

---

## 🛠️ Getting Started
1. Create a profile on the landing page.
2. Record a sound or upload a sample.
3. Click the grid to start making a beat!
4. Open the **Mixer** (sliders icon) to tweak the vibe.
5. Hit the **Download** icon to export your masterpiece as a WAV.
