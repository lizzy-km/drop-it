
"use client";

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface AudioClip {
  id: string;
  userId: string;
  name: string;
  audioData: string; 
  characterType: string; 
  createdAt: number;
}

export interface NoteProperty {
  id: string;
  clipId: string;
  velocity: number;      // 0 to 1
  finePitch: number;     // -100 to 100 cents
  panOffset: number;     // -1 to 1
  cutoffOffset: number;  // -1 to 1
  resOffset: number;     // -1 to 1
}

export interface ChannelSettings {
  volume: number;
  pitch: number;
  delay: number; 
  reverb: number; 
  pan: number; 
  cutoff: number; 
  distortion: number; 
  autoTune: number; 
  color: string; 
  muted: boolean;
  reversed: boolean;
  
  oscActive: boolean;
  svfActive: boolean;
  lfoActive: boolean;
  fxActive: boolean;
  ampActive: boolean;

  unison: number;
  vibrato: number;
  oscCoarse: number;
  oscFine: number;
  oscLevel: number;
  oscLfo: number;
  oscEnv: number;
  oscPw: number;

  ampAttack: number;
  ampHold: number;
  ampDecay: number;
  ampSustain: number;
  ampRelease: number;
  ampLevel: number;

  svfCut: number;
  svfEmph: number;
  svfEnv: number;
  svfLfo: number;
  svfKb: number;
  svfType: 'lowpass' | 'highpass' | 'bandpass';
  svfAttack: number;
  svfDecay: number;
  svfSustain: number;
  svfRelease: number;

  lfoRate: number;
  lfoDelay: number;

  limiterPre: number;
  limiterMix: number;

  attack: number;
  release: number;
  trimStart: number;
  trimEnd: number;
}

export interface Track {
  id: string;
  userId: string;
  title: string;
  bpm: number;
  numChannels: number;
  numSteps: number;
  grid: Record<string, NoteProperty[]>; 
  channelSettings: Record<string, ChannelSettings>;
  selectedClips: Record<string, string>; 
  createdAt: number;
}

export interface Preset {
  id: string;
  name: string;
  settings: Partial<ChannelSettings>;
  isFactory?: boolean;
}

const STORAGE_KEYS = {
  USERS: 'dropit_users',
  CLIPS: 'dropit_clips',
  TRACKS: 'dropit_tracks',
  CURRENT_USER: 'dropit_current_user_id',
  PRESETS: 'dropit_presets'
};

export const db = {
  getUsers: (): User[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [
      { id: 'u1', name: 'Producer 01', avatar: 'https://picsum.photos/seed/u1/200' },
      { id: 'u2', name: 'Producer 02', avatar: 'https://picsum.photos/seed/u2/200' }
    ];
  },
  
  saveUser: (user: User) => {
    const users = db.getUsers();
    const existing = users.findIndex(u => u.id === user.id);
    if (existing > -1) users[existing] = user;
    else users.push(user);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  },

  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!userId) return null;
    return db.getUsers().find(u => u.id === userId) || null;
  },

  setCurrentUser: (userId: string) => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, userId);
  },

  getClips: (userId?: string): AudioClip[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.CLIPS);
    let clips: AudioClip[] = data ? JSON.parse(data) : [];
    if (userId) return clips.filter(c => c.userId === userId);
    return clips;
  },

  saveClip: (clip: AudioClip) => {
    const clips = db.getClips();
    const existingIdx = clips.findIndex(c => c.id === clip.id);
    if (existingIdx > -1) clips[existingIdx] = clip;
    else clips.push(clip);
    localStorage.setItem(STORAGE_KEYS.CLIPS, JSON.stringify(clips));
  },

  deleteClip: (clipId: string) => {
    const clips = db.getClips().filter(c => c.id !== clipId);
    localStorage.setItem(STORAGE_KEYS.CLIPS, JSON.stringify(clips));
  },

  getTracks: (userId?: string): Track[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.TRACKS);
    let tracks: Track[] = data ? JSON.parse(data) : [];
    if (userId) return tracks.filter(t => t.userId === userId);
    return tracks;
  },

  getTrack: (trackId: string): Track | null => {
    const tracks = db.getTracks();
    return tracks.find(t => t.id === trackId) || null;
  },

  saveTrack: (track: Track) => {
    const tracks = db.getTracks();
    const existing = tracks.findIndex(t => t.id === track.id);
    if (existing > -1) tracks[existing] = track;
    else tracks.push(track);
    localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(tracks));
  },

  deleteTrack: (trackId: string) => {
    const tracks = db.getTracks().filter(t => t.id !== trackId);
    localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(tracks));
  },

  getPresets: (): Preset[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.PRESETS);
    return data ? JSON.parse(data) : [];
  },

  savePreset: (preset: Preset) => {
    const presets = db.getPresets();
    const existing = presets.findIndex(p => p.id === preset.id);
    if (existing > -1) presets[existing] = preset;
    else presets.push(preset);
    localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
  },

  getAllCreations: () => {
    const tracks = db.getTracks();
    const users = db.getUsers();
    return tracks.map(t => ({
      ...t,
      user: users.find(u => u.id === t.userId)
    }));
  }
};
