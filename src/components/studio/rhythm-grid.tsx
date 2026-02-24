"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Square, 
  Music, 
  Save, 
  Download, 
  Settings2, 
  Plus, 
  Trash2, 
  Sliders, 
  Disc, 
  Loader2, 
  Zap, 
  Waves, 
  Sparkles, 
  Mic2, 
  VolumeX, 
  Volume2, 
  RotateCcw, 
  Scissors, 
  Timer, 
  ArrowLeftRight,
  Settings,
  Volume1,
  Maximize2
} from 'lucide-react';
import { db, User, AudioClip, Track, ChannelSettings } from '@/lib/db';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const DEFAULT_CHANNELS = 4;
const MAX_STEPS = 64;

const CHANNEL_COLORS = [
  { name: 'Gold', class: 'bg-primary', hex: '#facc15' },
  { name: 'Red', class: 'bg-red-500', hex: '#ef4444' },
  { name: 'Blue', class: 'bg-blue-500', hex: '#3b82f6' },
  { name: 'Pink', class: 'bg-pink-500', hex: '#ec4899' },
  { name: 'Emerald', class: 'bg-emerald-500', hex: '#10b981' },
];

const DEFAULT_CHANNEL_SETTINGS: ChannelSettings = {
  volume: 0.8,
  pitch: 1.0,
  delay: 0,
  reverb: 0,
  pan: 0,
  cutoff: 1.0,
  distortion: 0,
  autoTune: 0,
  color: 'bg-primary',
  muted: false,
  reversed: false,
  attack: 0,
  release: 0.1,
  trimStart: 0,
  trimEnd: 1,
};

function audioBufferToWav(buffer: AudioBuffer) {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };

  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); 
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); 
  setUint16(1); 
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); 
  setUint16(numOfChan * 2); 
  setUint16(16); 

  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4); 

  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); 
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; 
      view.setInt16(pos, sample, true); 
      pos += 2;
    }
    offset++;
  }

  return new Blob([bufferArray], { type: "audio/wav" });
}

function makeDistortionCurve(amount: number) {
  const k = amount * 100;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export function RhythmGrid({ user, clips, track, onSaveTrack }: {
  user: User;
  clips: AudioClip[];
  track?: Track;
  onSaveTrack: (t: Track) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(track?.bpm || 120);
  const [numSteps, setNumSteps] = useState(track?.numSteps || 16);
  const [numChannels, setNumChannels] = useState(track?.numChannels || DEFAULT_CHANNELS);
  const [grid, setGrid] = useState<Record<string, string[]>>(track?.grid || {});
  const [isExporting, setIsExporting] = useState(false);
  const [channelSettings, setChannelSettings] = useState<Record<string, ChannelSettings>>(
    track?.channelSettings ||
    Object.fromEntries(Array.from({ length: DEFAULT_CHANNELS }).map((_, i) => [i.toString(), { ...DEFAULT_CHANNEL_SETTINGS, color: CHANNEL_COLORS[i % CHANNEL_COLORS.length].class }]))
  );
  const [selectedClipsForChannel, setSelectedClipsForChannel] = useState<Record<string, string>>(
    track?.selectedClips ||
    Object.fromEntries(Array.from({ length: DEFAULT_CHANNELS }).map((_, i) => [i.toString(), '']))
  );
  const [title, setTitle] = useState(track?.title || 'UNTITLED_SESSION');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const reversedBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const masterCompressorRef = useRef<DynamicsCompressorNode | null>(null);

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, ctx.currentTime);
      compressor.knee.setValueAtTime(40, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);
      compressor.connect(ctx.destination);
      
      masterCompressorRef.current = compressor;
      audioContextRef.current = ctx;
    }
    return audioContextRef.current;
  }, []);

  const loadAudio = useCallback(async (clip: AudioClip, targetContext?: BaseAudioContext) => {
    if (audioBuffersRef.current[clip.id]) return audioBuffersRef.current[clip.id];
    const ctx = targetContext || initAudioContext();
    try {
      const res = await fetch(clip.audioData);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBuffersRef.current[clip.id] = audioBuffer;
      return audioBuffer;
    } catch (error) {
      console.error("Audio Load Error:", error);
      throw error;
    }
  }, [initAudioContext]);

  const getReversedBuffer = (originalBuffer: AudioBuffer, clipId: string) => {
    if (reversedBuffersRef.current[clipId]) return reversedBuffersRef.current[clipId];
    
    const reversedBuffer = new AudioBuffer({
      length: originalBuffer.length,
      numberOfChannels: originalBuffer.numberOfChannels,
      sampleRate: originalBuffer.sampleRate
    });

    for (let i = 0; i < originalBuffer.numberOfChannels; i++) {
      const originalData = originalBuffer.getChannelData(i);
      const reversedData = reversedBuffer.getChannelData(i);
      for (let j = 0; j < originalBuffer.length; j++) {
        reversedData[j] = originalData[originalBuffer.length - 1 - j];
      }
    }
    
    reversedBuffersRef.current[clipId] = reversedBuffer;
    return reversedBuffer;
  };

  const playClip = useCallback(async (clipId: string, channelIdxString: string, manualTime?: number) => {
    const settings = channelSettings[channelIdxString] || DEFAULT_CHANNEL_SETTINGS;
    if (settings.muted && !manualTime) return; // Mute respects sequencer but not manual audition

    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    try {
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      let buffer = await loadAudio(clip);

      if (settings.reversed) {
        buffer = getReversedBuffer(buffer, clip.id);
      }
      
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const panNode = ctx.createStereoPanner();
      const filterNode = ctx.createBiquadFilter();
      const distortionNode = ctx.createWaveShaper();
      
      source.buffer = buffer;

      // Pitch/Auto-Tune
      let finalPitch = settings.pitch;
      if (settings.autoTune > 0) {
        const semitoneFactor = Math.pow(2, 1/12);
        const currentSteps = Math.log(settings.pitch) / Math.log(semitoneFactor);
        const snappedSteps = Math.round(currentSteps);
        const snappedPitch = Math.pow(semitoneFactor, snappedSteps);
        finalPitch = (settings.pitch * (1 - settings.autoTune)) + (snappedPitch * settings.autoTune);
      }

      source.playbackRate.value = finalPitch;
      panNode.pan.value = settings.pan || 0;
      filterNode.type = 'lowpass';
      filterNode.frequency.value = 200 + (Math.pow(settings.cutoff, 2) * 19800);
      
      if (settings.distortion > 0) {
        distortionNode.curve = makeDistortionCurve(settings.distortion);
        distortionNode.oversample = '4x';
      }

      const now = ctx.currentTime;
      const startTime = manualTime || now;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(settings.volume, startTime + settings.attack);
      
      const duration = buffer.duration / finalPitch;
      const trimStart = settings.trimStart * buffer.duration;
      const trimEnd = settings.trimEnd * buffer.duration;
      const playDuration = Math.max(0, trimEnd - trimStart) / finalPitch;
      
      const releaseStartTime = startTime + playDuration - settings.release;
      gainNode.gain.setValueAtTime(settings.volume, Math.max(startTime + settings.attack, releaseStartTime));
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + playDuration);

      source.connect(distortionNode);
      distortionNode.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(masterCompressorRef.current || ctx.destination);

      source.start(startTime, trimStart, playDuration);
    } catch (error) {
      console.error("Playback Error:", error);
    }
  }, [clips, loadAudio, initAudioContext, channelSettings]);

  const exportToAudio = async () => {
    if (isExporting) return;
    setIsExporting(true);
    
    try {
      const stepDuration = (60 / bpm) / 4;
      const totalDuration = numSteps * stepDuration + 2;
      const sampleRate = 44100;
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * totalDuration), sampleRate);

      const uniqueUsedClipIds = new Set(Object.values(grid).flat());
      for (const id of uniqueUsedClipIds) {
        const clip = clips.find(c => c.id === id);
        if (clip) await loadAudio(clip, offlineCtx);
      }

      const compressor = offlineCtx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, offlineCtx.currentTime);
      compressor.knee.setValueAtTime(40, offlineCtx.currentTime);
      compressor.ratio.setValueAtTime(12, offlineCtx.currentTime);
      compressor.attack.setValueAtTime(0, offlineCtx.currentTime);
      compressor.release.setValueAtTime(0.25, offlineCtx.currentTime);
      compressor.connect(offlineCtx.destination);

      for (let ch = 0; ch < numChannels; ch++) {
        const settings = channelSettings[ch.toString()] || DEFAULT_CHANNEL_SETTINGS;
        if (settings.muted) continue;

        for (let st = 0; st < numSteps; st++) {
          const clipIds = grid[`${ch}-${st}`];
          if (clipIds) {
            for (const clipId of clipIds) {
              const clip = clips.find(c => c.id === clipId);
              if (!clip) continue;
              
              let buffer = audioBuffersRef.current[clip.id];
              if (!buffer) continue;

              if (settings.reversed) {
                buffer = getReversedBuffer(buffer, clip.id);
              }

              const source = offlineCtx.createBufferSource();
              const gainNode = offlineCtx.createGain();
              const panNode = offlineCtx.createStereoPanner();
              const filterNode = offlineCtx.createBiquadFilter();
              const distortionNode = offlineCtx.createWaveShaper();

              source.buffer = buffer;

              let finalPitch = settings.pitch;
              if (settings.autoTune > 0) {
                const semitoneFactor = Math.pow(2, 1/12);
                const currentSteps = Math.log(settings.pitch) / Math.log(semitoneFactor);
                const snappedSteps = Math.round(currentSteps);
                const snappedPitch = Math.pow(semitoneFactor, snappedSteps);
                finalPitch = (settings.pitch * (1 - settings.autoTune)) + (snappedPitch * settings.autoTune);
              }

              source.playbackRate.value = finalPitch;
              panNode.pan.value = settings.pan || 0;
              filterNode.type = 'lowpass';
              filterNode.frequency.value = 200 + (Math.pow(settings.cutoff, 2) * 19800);

              if (settings.distortion > 0) {
                distortionNode.curve = makeDistortionCurve(settings.distortion);
                distortionNode.oversample = '4x';
              }

              const startTime = st * stepDuration;
              const trimStart = settings.trimStart * buffer.duration;
              const trimEnd = settings.trimEnd * buffer.duration;
              const playDuration = Math.max(0, trimEnd - trimStart) / finalPitch;

              gainNode.gain.setValueAtTime(0, startTime);
              gainNode.gain.linearRampToValueAtTime(settings.volume, startTime + settings.attack);
              
              const releaseStartTime = startTime + playDuration - settings.release;
              gainNode.gain.setValueAtTime(settings.volume, Math.max(startTime + settings.attack, releaseStartTime));
              gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + playDuration);

              source.connect(distortionNode);
              distortionNode.connect(filterNode);
              filterNode.connect(gainNode);
              gainNode.connect(panNode);
              panNode.connect(compressor);

              source.start(startTime, trimStart, playDuration);
            }
          }
        }
      }

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      const url = URL.createObjectURL(wavBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_export.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Export Complete", description: "Your master .wav is ready!" });
    } catch (err) {
      console.error(err);
      toast({ title: "Export Failed", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const toggleCell = async (channelIdx: number, step: number) => {
    const clipId = selectedClipsForChannel[channelIdx.toString()];
    if (!clipId) {
      toast({ title: "Assign a sound to this track first!" });
      return;
    }
    const key = `${channelIdx}-${step}`;
    const newGrid = { ...grid };
    if (newGrid[key]?.includes(clipId)) {
      newGrid[key] = newGrid[key].filter(id => id !== clipId);
      if (newGrid[key].length === 0) delete newGrid[key];
    } else {
      newGrid[key] = [clipId];
      await playClip(clipId, channelIdx.toString());
    }
    setGrid(newGrid);
  };

  const handlePlayToggle = async () => {
    const ctx = initAudioContext();
    if (isPlaying) {
      setIsPlaying(false);
      setCurrentStep(-1);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (ctx.state === 'suspended') await ctx.resume();
      setIsPlaying(true);
      setCurrentStep(0);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      const stepInterval = (60 / bpm) / 4 * 1000;
      timerRef.current = setInterval(() => {
        setCurrentStep(prev => {
          const next = (prev + 1) % numSteps;
          for (let c = 0; c < numChannels; c++) {
            const clipIds = grid[`${c}-${next}`];
            if (clipIds) {
              clipIds.forEach(id => playClip(id, c.toString()));
            }
          }
          return next;
        });
      }, stepInterval);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, bpm, grid, playClip, numChannels, numSteps]);

  const updateChannelSetting = (channelIdx: number, key: keyof ChannelSettings, value: any) => {
    setChannelSettings(prev => ({
      ...prev,
      [channelIdx.toString()]: {
        ...prev[channelIdx.toString()] || DEFAULT_CHANNEL_SETTINGS,
        [key]: value
      }
    }));
  };

  const addChannel = () => {
    const nextIdx = numChannels;
    setNumChannels(prev => prev + 1);
    setChannelSettings(prev => ({
      ...prev,
      [nextIdx.toString()]: { ...DEFAULT_CHANNEL_SETTINGS, color: CHANNEL_COLORS[nextIdx % CHANNEL_COLORS.length].class }
    }));
    setSelectedClipsForChannel(prev => ({ ...prev, [nextIdx.toString()]: '' }));
  };

  const removeChannel = (idx: number) => {
    if (numChannels <= 1) return;
    setNumChannels(prev => prev - 1);
    const newGrid: Record<string, string[]> = {};
    Object.keys(grid).forEach(key => {
      const [c, s] = key.split('-').map(Number);
      if (c === idx) return;
      const newC = c > idx ? c - 1 : c;
      newGrid[`${newC}-${s}`] = grid[key];
    });
    setGrid(newGrid);
  };

  return (
    <div className="space-y-8">
      <div className="glass-panel p-8 rounded-[2.5rem] gold-shadow flex flex-col xl:flex-row items-center justify-between gap-8 border-primary/30">
        <div className="flex flex-col md:flex-row items-center gap-10 flex-1 w-full">
          <div className="space-y-1 flex-1">
             <input
                value={title}
                onChange={(e) => setTitle(e.target.value.toUpperCase())}
                className="text-4xl font-black italic tracking-tighter bg-transparent border-none focus:ring-0 w-full outline-none text-primary"
                placeholder="PROJECT_NAME"
              />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] px-1">Session Live Studio</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-12 bg-black/30 p-6 rounded-3xl border border-white/5">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Tempo</span>
                <span className="text-xs font-black text-primary">{bpm} BPM</span>
              </div>
              <input
                type="range" min="60" max="220" value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value))}
                className="w-32 accent-primary h-1.5 cursor-pointer bg-white/10 rounded-full appearance-none"
              />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Length</span>
                <span className="text-xs font-black text-primary">{numSteps} Steps</span>
              </div>
              <input
                type="range" min="4" max={MAX_STEPS} step="4" value={numSteps}
                onChange={(e) => setNumSteps(parseInt(e.target.value))}
                className="w-32 accent-primary h-1.5 cursor-pointer bg-white/10 rounded-full appearance-none"
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button
            variant={isPlaying ? "destructive" : "default"}
            className={cn(
              "rounded-full px-12 h-16 font-black uppercase tracking-[0.2em] shadow-2xl transition-all scale-105", 
              isPlaying ? "bg-red-500 hover:bg-red-600" : "bg-primary text-black hover:bg-primary/90"
            )}
            onClick={handlePlayToggle}
          >
            {isPlaying ? <Square className="w-5 h-5 mr-3 fill-current" /> : <Play className="w-5 h-5 mr-3 fill-current" />}
            {isPlaying ? "Stop" : "Play"}
          </Button>

          <div className="flex items-center gap-2 bg-black/20 p-2 rounded-full border border-primary/10">
            <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 text-primary hover:bg-primary/10" onClick={() => {
              db.saveTrack({ id: track?.id || crypto.randomUUID(), userId: user.id, title, bpm, numChannels, numSteps, grid, channelSettings, selectedClips: selectedClipsForChannel, createdAt: Date.now() });
              toast({ title: "Session Saved" });
            }}>
              <Save className="w-5 h-5" />
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={isExporting}
              className="rounded-full h-12 w-12 text-primary hover:bg-primary/10 disabled:opacity-50" 
              onClick={exportToAudio}
            >
              {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-[2.5rem] p-10 gold-shadow space-y-6 overflow-x-auto border-primary/20">
        {Array.from({ length: numChannels }).map((_, chIdx) => {
          const s = channelSettings[chIdx.toString()] || DEFAULT_CHANNEL_SETTINGS;
          const selId = selectedClipsForChannel[chIdx.toString()] || '';
          return (
            <div key={chIdx} className="flex items-center gap-10 group animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="w-[320px] shrink-0 flex items-center gap-4 bg-black/40 p-4 rounded-3xl gold-border relative">
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => { if (selId) playClip(selId, chIdx.toString(), initAudioContext().currentTime); }}
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg shrink-0", 
                      s.muted ? "bg-neutral-800" : s.color
                    )}
                  >
                    <Music className={cn("w-6 h-6", s.muted ? "text-muted-foreground" : "text-black")} />
                  </button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={cn(
                      "w-12 h-8 rounded-lg transition-colors", 
                      s.muted ? "text-red-500 bg-red-500/10" : "text-muted-foreground hover:bg-white/5"
                    )}
                    onClick={() => updateChannelSetting(chIdx, 'muted', !s.muted)}
                  >
                    {s.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <select
                    className="text-[10px] font-black uppercase tracking-widest bg-transparent focus:outline-none text-primary cursor-pointer hover:underline w-full truncate"
                    value={selId}
                    onChange={(e) => setSelectedClipsForChannel(p => ({ ...p, [chIdx.toString()]: e.target.value }))}
                  >
                    <option value="" className="bg-neutral-900">NO_SOUND</option>
                    {clips.map(c => (<option key={c.id} value={c.id} className="bg-neutral-900">{c.name.toUpperCase()}</option>))}
                  </select>
                  <div className="flex gap-1">
                    {CHANNEL_COLORS.map(c => (
                      <button
                        key={c.name}
                        onClick={() => updateChannelSetting(chIdx, 'color', c.class)}
                        className={cn("w-2.5 h-2.5 rounded-full border border-transparent transition-all", c.class, s.color === c.class ? "border-white scale-125" : "opacity-30 hover:opacity-50")}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10">
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl glass-panel border-primary/20 rounded-[2.5rem] p-10 gold-shadow overflow-hidden">
                      <DialogHeader className="mb-8">
                        <div className="flex items-center justify-between">
                          <DialogTitle className="text-4xl font-black italic tracking-tighter text-primary flex items-center gap-4">
                            <Settings className="w-8 h-8" /> SAMPLER_EDITOR
                          </DialogTitle>
                          <Button 
                            className="bg-primary text-black font-black uppercase tracking-widest rounded-full h-12 px-8 hover:bg-primary/90"
                            onClick={() => { if (selId) playClip(selId, chIdx.toString(), initAudioContext().currentTime); }}
                          >
                            <Volume2 className="w-4 h-4 mr-2" /> Audition
                          </Button>
                        </div>
                      </DialogHeader>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 overflow-y-auto max-h-[60vh] pr-4 custom-scrollbar">
                        {/* Basic Gain & Pan */}
                        <div className="space-y-6 bg-black/40 p-8 rounded-[2rem] border border-white/5 gold-border">
                          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <Volume1 className="w-4 h-4" /> Basic Gain & Panning
                          </h4>
                          <div className="space-y-6">
                            <div className="space-y-3">
                              <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                <span>Gain</span><span>{Math.round(s.volume * 100)}%</span>
                              </div>
                              <Slider value={[s.volume * 100]} min={0} max={100} onValueChange={(v) => updateChannelSetting(chIdx, 'volume', v[0] / 100)} className="h-2" />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                <span>Pan</span><span>{s.pan < 0 ? 'L' : s.pan > 0 ? 'R' : 'C'} {Math.abs(Math.round(s.pan * 100))}%</span>
                              </div>
                              <Slider value={[(s.pan + 1) * 50]} min={0} max={100} onValueChange={(v) => updateChannelSetting(chIdx, 'pan', (v[0] / 50) - 1)} className="h-2" />
                            </div>
                          </div>
                        </div>

                        {/* Sample Modification */}
                        <div className="space-y-6 bg-black/40 p-8 rounded-[2rem] border border-white/5 gold-border">
                          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <Scissors className="w-4 h-4" /> Sample Modification
                          </h4>
                          <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                              <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2">
                                <RotateCcw className="w-4 h-4" /> Reverse Sample
                              </Label>
                              <Switch checked={s.reversed} onCheckedChange={(v) => updateChannelSetting(chIdx, 'reversed', v)} />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                                <span>Trim Start</span><span>{Math.round(s.trimStart * 100)}%</span>
                              </div>
                              <Slider value={[s.trimStart * 100]} min={0} max={s.trimEnd * 100 - 1} onValueChange={(v) => updateChannelSetting(chIdx, 'trimStart', v[0] / 100)} className="h-2" />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground tracking-widest">
                                <span>Trim End</span><span>{Math.round(s.trimEnd * 100)}%</span>
                              </div>
                              <Slider value={[s.trimEnd * 100]} min={s.trimStart * 100 + 1} max={100} onValueChange={(v) => updateChannelSetting(chIdx, 'trimEnd', v[0] / 100)} className="h-2" />
                            </div>
                          </div>
                        </div>

                        {/* Envelope (ADSR) */}
                        <div className="space-y-6 bg-black/40 p-8 rounded-[2rem] border border-white/5 gold-border">
                          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <Timer className="w-4 h-4" /> Envelope (ADSR)
                          </h4>
                          <div className="space-y-6">
                            <div className="space-y-3">
                              <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                <span>Attack</span><span>{(s.attack).toFixed(2)}s</span>
                              </div>
                              <Slider value={[s.attack * 50]} min={0} max={100} onValueChange={(v) => updateChannelSetting(chIdx, 'attack', v[0] / 50)} className="h-2" />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                                <span>Release</span><span>{(s.release).toFixed(2)}s</span>
                              </div>
                              <Slider value={[s.release * 50]} min={0.5} max={100} onValueChange={(v) => updateChannelSetting(chIdx, 'release', v[0] / 50)} className="h-2" />
                            </div>
                          </div>
                        </div>

                        {/* Effects Rack */}
                        <div className="space-y-6 bg-black/40 p-8 rounded-[2rem] border border-white/5 lg:col-span-3 gold-border">
                          <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> Audio Effects Rack
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            <div className="space-y-3">
                              <div className="flex justify-between text-[9px] font-black uppercase text-primary/80">
                                <span className="flex items-center gap-1"><Mic2 className="w-3 h-3" /> Auto-Tune</span>
                                <span>{Math.round(s.autoTune * 100)}%</span>
                              </div>
                              <Slider value={[s.autoTune * 100]} min={0} max={100} onValueChange={(v) => updateChannelSetting(chIdx, 'autoTune', v[0] / 100)} className="h-2 accent-primary" />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                <span>Pitch</span><span>{s.pitch.toFixed(1)}x</span>
                              </div>
                              <Slider value={[s.pitch * 50]} min={25} max={100} onValueChange={(v) => updateChannelSetting(chIdx, 'pitch', v[0] / 50)} className="h-2" />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                <span>Filter (Cutoff)</span><span>{Math.round(s.cutoff * 100)}%</span>
                              </div>
                              <Slider value={[s.cutoff * 100]} min={0} max={100} onValueChange={(v) => updateChannelSetting(chIdx, 'cutoff', v[0] / 100)} className="h-2" />
                            </div>
                            <div className="space-y-3">
                              <div className="flex justify-between text-[9px] font-black uppercase text-primary/80">
                                <span className="flex items-center gap-1"><Waves className="w-3 h-3" /> Drive (Distortion)</span>
                                <span>{Math.round(s.distortion * 100)}%</span>
                              </div>
                              <Slider value={[s.distortion * 100]} min={0} max={100} onValueChange={(v) => updateChannelSetting(chIdx, 'distortion', v[0] / 100)} className="h-2 accent-primary" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <DialogFooter className="mt-10 border-t border-white/10 pt-8">
                        <Button 
                          className="bg-primary text-black font-black uppercase tracking-[0.3em] rounded-full h-14 w-full md:w-auto px-12 shadow-2xl hover:bg-primary/90"
                          onClick={() => {
                            toast({ title: "Modifications Saved", description: "All sampler parameters committed to track memory." });
                          }}
                        >
                          <Save className="w-5 h-5 mr-3" /> Commit Changes
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removeChannel(chIdx)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex-1 flex gap-2 h-20 py-1 overflow-x-auto custom-scrollbar">
                {Array.from({ length: numSteps }).map((_, stepIdx) => {
                  const clipIds = grid[`${chIdx}-${stepIdx}`] || [];
                  const activeClipId = clipIds[0];
                  const clip = clips.find(c => c.id === activeClipId);
                  const char = CHARACTER_TYPES.find(ct => ct.id === clip?.characterType);
                  const CharIcon = char?.icon;
                  const isMajorBeat = stepIdx % 4 === 0;
                  const isCurrent = stepIdx === currentStep;

                  return (
                    <button
                      key={stepIdx}
                      disabled={s.muted}
                      onClick={() => toggleCell(chIdx, stepIdx)}
                      className={cn(
                        "w-14 h-full rounded-2xl transition-all duration-300 flex items-center justify-center relative overflow-hidden shrink-0 group/cell gold-shadow",
                        isCurrent ? "scale-110 z-10" : "scale-100",
                        clip 
                          ? `${s.muted ? "bg-neutral-800 opacity-40" : s.color} shadow-2xl ring-2 ring-white/30 translate-y-[-2px]` 
                          : "bg-neutral-800/80 hover:bg-neutral-700/80 border border-white/5",
                        isMajorBeat && !clip ? "bg-neutral-800 border-white/10" : "",
                        isCurrent && !clip ? "ring-2 ring-primary/40 bg-neutral-700" : "",
                        s.muted && clip && "grayscale"
                      )}
                    >
                      {CharIcon && <CharIcon className={cn("w-7 h-7 transition-transform group-hover/cell:scale-125", isCurrent ? "animate-bounce text-black" : "text-black/80")} />}
                      {isCurrent && <div className="absolute inset-0 bg-primary/20 animate-pulse pointer-events-none" />}
                      {!clip && isMajorBeat && <div className="absolute bottom-1 w-1 h-1 bg-white/10 rounded-full" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <Button 
          variant="outline" 
          className="w-full border-dashed border-2 py-10 rounded-[2rem] gap-4 bg-black/20 border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all group mt-4" 
          onClick={addChannel}
        >
          <Plus className="w-5 h-5 text-primary group-hover:scale-125 duration-300" />
          <span className="font-black uppercase tracking-[0.4em] text-[10px] text-muted-foreground group-hover:text-primary">New Track</span>
        </Button>
      </div>
    </div>
  );
}
