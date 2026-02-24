
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
  audioData: string; // Base64 or local blob reference
  characterType: string; // 'monster', 'robot', 'ghost', 'star'
  createdAt: number;
}

export interface ChannelSettings {
  volume: number;
  pitch: number;
  delay: number; // 0 to 1 (mix/feedback)
  reverb: number; // 0 to 1 (room size/wetness)
  pan: number; // -1 to 1
  cutoff: number; // 0 to 1
  distortion: number; // 0 to 1 (drive)
  autoTune: number; // 0 to 1 (quantization intensity)
  color: string; // Hex or tailwind class color
}

export interface Track {
  id: string;
  userId: string;
  title: string;
  bpm: number;
  numChannels: number;
  numSteps: number;
  grid: Record<string, string[]>; // e.g., { "0-0": ["clipId1"], "1-4": ["clipId2"] }
  channelSettings: Record<string, ChannelSettings>;
  selectedClips: Record<string, string>; // Maps channel index string to clip ID
  createdAt: number;
}

const STORAGE_KEYS = {
  USERS: 'dropit_users',
  CLIPS: 'dropit_clips',
  TRACKS: 'dropit_tracks',
  CURRENT_USER: 'dropit_current_user_id'
};

export const db = {
  getUsers: (): User[] => {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : [
      { id: 'u1', name: 'Master Beat', avatar: 'https://picsum.photos/seed/u1/200' },
      { id: 'u2', name: 'DJ Flow', avatar: 'https://picsum.photos/seed/u2/200' }
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
    if (userId) clips = clips.filter(c => c.userId === userId);
    return clips;
  },

  saveClip: (clip: AudioClip) => {
    const clips = db.getClips();
    clips.push(clip);
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
    if (userId) tracks = tracks.filter(t => t.userId === userId);
    return tracks;
  },

  saveTrack: (track: Track) => {
    const tracks = db.getTracks();
    const existing = tracks.findIndex(t => t.id === track.id);
    if (existing > -1) tracks[existing] = track;
    else tracks.push(track);
    localStorage.setItem(STORAGE_KEYS.TRACKS, JSON.stringify(tracks));
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
