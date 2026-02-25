
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Play, Square, Music, Save, Download, Plus, Trash2, 
  Loader2, Gauge, X, AlertTriangle, Dices, ArrowLeft, ArrowRight, Copy, FileUp, FileDown, Volume1, Volume2, VolumeX
} from 'lucide-react';
import { db, User, AudioClip, Track, ChannelSettings } from '@/lib/db';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MasterVisualizer } from './visualizers';
import { ChannelSettingsDialog } from './channel-settings-dialog';
import { makeDistortionCurve, audioBufferToWav } from '@/lib/audio-utils';

const DEFAULT_CHANNELS = 4;
const MAX_STEPS = 64;

const CHANNEL_COLORS = [
  { name: 'Gold', class: 'bg-primary', hex: '#facc15' },
  { name: 'Electric', class: 'bg-cyan-400', hex: '#22d3ee' },
  { name: 'Vibrant', class: 'bg-rose-500', hex: '#f43f5e' },
  { name: 'Neon', class: 'bg-lime-400', hex: '#a3e635' },
  { name: 'Spirit', class: 'bg-indigo-500', hex: '#6366f1' },
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

export function RhythmGrid({ user, clips, track, onSaveTrack, onImportRefresh }: {
  user: User;
  clips: AudioClip[];
  track?: Track;
  onSaveTrack: (t: Track) => void;
  onImportRefresh?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(track?.bpm || 120);
  const [numSteps, setNumSteps] = useState(track?.numSteps || 16);
  const [numChannels, setNumChannels] = useState(track?.numChannels || DEFAULT_CHANNELS);
  const [grid, setGrid] = useState<Record<string, string[]>>(track?.grid || {});
  const [title, setTitle] = useState(track?.title || 'SONIC_MANIFEST_01');
  
  const [channelSettings, setChannelSettings] = useState<Record<string, ChannelSettings>>(
    track?.channelSettings ||
    Object.fromEntries(Array.from({ length: DEFAULT_CHANNELS }).map((_, i) => [i.toString(), { ...DEFAULT_CHANNEL_SETTINGS, color: CHANNEL_COLORS[i % CHANNEL_COLORS.length].class }]))
  );
  const [selectedClipsForChannel, setSelectedClipsForChannel] = useState<Record<string, string>>(
    track?.selectedClips ||
    Object.fromEntries(Array.from({ length: DEFAULT_CHANNELS }).map((_, i) => [i.toString(), '']))
  );

  const schedulerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const reversedBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const importFileRef = useRef<HTMLInputElement>(null);
  
  const nextNoteTimeRef = useRef<number>(0);
  const currentStepRef = useRef<number>(0);
  const lookAheadTime = 0.1; 
  const scheduleInterval = 25; 

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, ctx.currentTime);
      const masterGain = ctx.createGain();
      masterGain.gain.value = 1.0;
      compressor.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);
      masterAnalyserRef.current = analyser;
      audioContextRef.current = ctx;
    }
    return audioContextRef.current;
  }, []);

  const loadAudio = useCallback(async (clip: AudioClip, context?: BaseAudioContext) => {
    if (audioBuffersRef.current[clip.id]) return audioBuffersRef.current[clip.id];
    const ctx = context || initAudioContext();
    try {
      const res = await fetch(clip.audioData);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBuffersRef.current[clip.id] = audioBuffer;
      return audioBuffer;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [initAudioContext]);

  const playClip = useCallback(async (clipId: string, channelIdx: string, scheduledTime?: number, context?: BaseAudioContext) => {
    const settings = channelSettings[channelIdx] || DEFAULT_CHANNEL_SETTINGS;
    if (settings.muted && !scheduledTime) return;

    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    try {
      const ctx = context || initAudioContext();
      if (ctx instanceof AudioContext && ctx.state === 'suspended') await ctx.resume();
      
      let buffer = await loadAudio(clip, ctx);
      if (!buffer) return;

      if (settings.reversed) {
        if (!reversedBuffersRef.current[clipId]) {
          const rev = new AudioBuffer({ length: buffer.length, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
          for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
              rev.getChannelData(channel)[i] = buffer.getChannelData(channel)[buffer.length - 1 - i];
            }
          }
          reversedBuffersRef.current[clipId] = rev;
        }
        buffer = reversedBuffersRef.current[clipId];
      }

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const panNode = ctx.createStereoPanner();
      const filterNode = ctx.createBiquadFilter();
      const distortionNode = ctx.createWaveShaper();
      const delayNode = ctx.createDelay(1.0);
      const delayGain = ctx.createGain();

      const playbackRate = settings.pitch;
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      panNode.pan.value = settings.pan;
      filterNode.frequency.value = 200 + (Math.pow(settings.cutoff, 2) * 19800);

      const startTime = scheduledTime !== undefined ? scheduledTime : ctx.currentTime;
      const duration = (buffer.duration * (settings.trimEnd - settings.trimStart)) / playbackRate;
      const trimStartOffset = settings.trimStart * buffer.duration;

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(settings.volume, startTime + settings.attack);
      gainNode.gain.setValueAtTime(settings.volume, Math.max(startTime + duration - settings.release, startTime + settings.attack));
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      source.connect(filterNode);
      filterNode.connect(distortionNode);
      if (settings.distortion > 0) {
        distortionNode.curve = makeDistortionCurve(settings.distortion);
      }
      distortionNode.connect(gainNode);
      gainNode.connect(panNode);
      
      const destination = context ? context.destination : (masterAnalyserRef.current || ctx.destination);
      panNode.connect(destination);

      if (settings.delay > 0) {
        delayNode.delayTime.value = 0.25; 
        delayGain.gain.value = settings.delay * 0.5;
        panNode.connect(delayNode);
        delayNode.connect(delayGain);
        delayGain.connect(delayNode);
        delayGain.connect(destination);
      }
      source.start(startTime, trimStartOffset, duration);
    } catch (e) { console.error(e); }
  }, [clips, loadAudio, initAudioContext, channelSettings]);

  const scheduleNextNote = useCallback(() => {
    const ctx = initAudioContext();
    const secondsPerBeat = 60.0 / bpm;
    const secondsPerStep = secondsPerBeat / 4;

    while (nextNoteTimeRef.current < ctx.currentTime + lookAheadTime) {
      const stepToSchedule = currentStepRef.current;
      for (let c = 0; c < numChannels; c++) {
        const clipIds = grid[`${c}-${stepToSchedule}`];
        if (clipIds) {
          clipIds.forEach(id => playClip(id, c.toString(), nextNoteTimeRef.current));
        }
      }
      nextNoteTimeRef.current += secondsPerStep;
      currentStepRef.current = (currentStepRef.current + 1) % numSteps;
      setTimeout(() => setCurrentStep(stepToSchedule), (nextNoteTimeRef.current - ctx.currentTime) * 1000);
    }
  }, [bpm, grid, numChannels, numSteps, playClip, initAudioContext]);

  useEffect(() => {
    if (isPlaying) {
      const ctx = initAudioContext();
      nextNoteTimeRef.current = ctx.currentTime;
      currentStepRef.current = 0;
      schedulerTimerRef.current = setInterval(scheduleNextNote, scheduleInterval);
    } else {
      if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
      setCurrentStep(-1);
    }
    return () => { if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current); };
  }, [isPlaying, scheduleNextNote, initAudioContext]);

  const randomizePattern = () => {
    if (clips.length === 0) return toast({ title: "No Samples", variant: "destructive" });
    const newGrid: Record<string, string[]> = {};
    for (let c = 0; c < numChannels; c++) {
      const clipId = selectedClipsForChannel[c.toString()] || (clips.length > 0 ? clips[Math.floor(Math.random() * clips.length)].id : '');
      if (!clipId) continue;
      for (let s = 0; s < numSteps; s++) { if (Math.random() > 0.8) newGrid[`${c}-${s}`] = [clipId]; }
    }
    setGrid(newGrid);
  };

  const shiftPattern = (direction: 'left' | 'right') => {
    const newGrid: Record<string, string[]> = {};
    Object.keys(grid).forEach(key => {
      const [ch, step] = key.split('-').map(Number);
      let newStep = direction === 'right' ? (step + 1) % numSteps : (step - 1 + numSteps) % numSteps;
      newGrid[`${ch}-${newStep}`] = grid[key];
    });
    setGrid(newGrid);
  };

  const mirrorPattern = () => {
    const newGrid = { ...grid };
    const half = Math.floor(numSteps / 2);
    for (let c = 0; c < numChannels; c++) {
      for (let s = 0; s < half; s++) {
        const sourceKey = `${c}-${s}`;
        const targetKey = `${c}-${s + half}`;
        if (newGrid[sourceKey]) newGrid[targetKey] = [...newGrid[sourceKey]];
        else delete newGrid[targetKey];
      }
    }
    setGrid(newGrid);
  };

  const handleSave = () => {
    const newTrack: Track = { id: track?.id || crypto.randomUUID(), userId: user.id, title, bpm, numChannels, numSteps, grid, channelSettings, selectedClips: selectedClipsForChannel, createdAt: Date.now() };
    db.saveTrack(newTrack);
    onSaveTrack(newTrack);
    toast({ title: "Session Synchronized" });
  };

  const handleExportProject = () => {
    const projectData = {
      track: {
        title,
        bpm,
        numChannels,
        numSteps,
        grid,
        channelSettings,
        selectedClips: selectedClipsForChannel
      },
      clips: clips.filter(c => Object.values(selectedClipsForChannel).includes(c.id) || Object.values(grid).flat().includes(c.id))
    };
    
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_config.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Project Config Exported" });
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.track || !data.clips) throw new Error("Invalid Project File");

        data.clips.forEach((clip: AudioClip) => {
          const existingClips = db.getClips(user.id);
          if (!existingClips.find(ec => ec.id === clip.id)) {
            db.saveClip(clip);
          }
        });

        setTitle(data.track.title);
        setBpm(data.track.bpm);
        setNumChannels(data.track.numChannels);
        setNumSteps(data.track.numSteps);
        setGrid(data.track.grid);
        setChannelSettings(data.track.channelSettings);
        setSelectedClipsForChannel(data.track.selectedClips);

        if (onImportRefresh) onImportRefresh();

        toast({ title: "Project Config Imported", description: "All assets synchronized." });
      } catch (err) {
        toast({ title: "Import Failed", description: "The file is corrupted or invalid.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleExportAudio = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const secondsPerBeat = 60.0 / bpm;
      const secondsPerStep = secondsPerBeat / 4;
      const totalDuration = numSteps * secondsPerStep;
      const offlineCtx = new OfflineAudioContext(2, 44100 * totalDuration, 44100);
      for (let s = 0; s < numSteps; s++) {
        const timeOffset = s * secondsPerStep;
        for (let c = 0; c < numChannels; c++) {
          const clipIds = grid[`${c}-${s}`];
          if (clipIds) for (const id of clipIds) await playClip(id, c.toString(), timeOffset, offlineCtx);
        }
      }
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error(err); } finally { setIsExporting(false); }
  };

  return (
    <div className="space-y-12">
      <input type="file" accept=".json" ref={importFileRef} className="hidden" onChange={handleImportProject} />
      <div className="glass-panel p-10 rounded-[3rem] gold-shadow relative overflow-hidden">
        <div className="absolute inset-0 studio-grid-bg opacity-10" />
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
          <div className="flex-1 space-y-6 w-full">
            <input value={title} onChange={(e) => setTitle(e.target.value.toUpperCase())} className="text-6xl font-black italic tracking-tighter bg-transparent border-none focus:ring-0 w-full outline-none text-primary" placeholder="PROJECT_ID" />
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex items-center gap-4 h-[60] rounded-[2rem] px-8 py-4 border border-primary/20 flex-1 w-full bg-black/20">
                <div className="flex items-center gap-2 px-4 border-r border-primary/10">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={randomizePattern} className="h-10 px-4 rounded-xl text-[10px] font-black uppercase border border-primary/10"><Dices className="w-3.5 h-3.5" /> Random</Button>
                  <Button variant="ghost" size="icon" onClick={() => shiftPattern('left')} className="h-10 w-10 border border-primary/10"><ArrowLeft className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => shiftPattern('right')} className="h-10 w-10 border border-primary/10"><ArrowRight className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={mirrorPattern} className="h-10 px-4 rounded-xl text-[10px] font-black uppercase border border-primary/10"><Copy className="w-3.5 h-3.5" /> Mirror</Button>
                  <Button variant="ghost" size="sm" onClick={() => setGrid({})} className="h-10 px-4 rounded-xl text-[10px] font-black uppercase text-red-500 border border-red-500/20"><X className="w-3.5 h-3.5" /> Clear</Button>
                </div>
              </div>
              <div className="w-full md:w-64"><MasterVisualizer analyser={masterAnalyserRef.current} /></div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black uppercase text-muted-foreground">TEMPO</span>
              <div className="bg-black/40 px-6 py-4 rounded-2xl border border-white/5 font-black text-2xl text-primary">{bpm}</div>
              <Slider value={[bpm]} min={60} max={200} onValueChange={(v) => setBpm(v[0])} className="w-32 h-1.5" />
            </div>
            <Button variant={isPlaying ? "destructive" : "default"} className={cn("w-24 h-24 rounded-[2.5rem] shadow-2xl", isPlaying ? "bg-red-500 animate-pulse" : "bg-primary text-black")} onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Square className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </Button>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary" onClick={() => importFileRef.current?.click()} title="Import Project Config"><FileUp className="w-5 h-5" /></Button>
                <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary" onClick={handleExportProject} title="Export Project Config"><FileDown className="w-5 h-5" /></Button>
              </div>
              <div className="flex gap-2">
                <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary" onClick={handleSave} title="Save to Browser"><Save className="w-5 h-5" /></Button>
                <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-primary/20 text-primary" onClick={handleExportAudio} disabled={isExporting} title="Download Master WAV">
                  {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-[3rem] p-12 gold-shadow overflow-x-auto space-y-8 bg-black/40">
        {Array.from({ length: numChannels }).map((_, chIdx) => {
          const chKey = chIdx.toString();
          const s = channelSettings[chKey] || DEFAULT_CHANNEL_SETTINGS;
          const selId = selectedClipsForChannel[chKey] || '';
          return (
            <div key={chIdx} className="flex items-center gap-8">
              <div className="w-[460px] shrink-0 bg-neutral-900/60 p-6 rounded-[2.5rem] flex items-center gap-6 border border-white/5">
                <button onClick={() => { if (selId) playClip(selId, chKey); }} className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-2xl shrink-0", s.muted ? "bg-neutral-800" : s.color)}>
                  <Music className={cn("w-8 h-8", s.muted ? "text-muted-foreground" : "text-black")} />
                </button>
                <div className="flex-1 space-y-4 min-w-0">
                  <select className="w-full bg-transparent text-[11px] font-black uppercase text-primary outline-none cursor-pointer truncate" value={selId} onChange={(e) => setSelectedClipsForChannel(p => ({ ...p, [chKey]: e.target.value }))}>
                    <option value="" className="bg-black">SELECT_SIGNAL</option>
                    {clips.map(c => <option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
                  </select>
                  <div className="flex items-center gap-4">
                    <Volume1 className="w-3.5 h-3.5 text-muted-foreground" />
                    <Slider value={[s.volume * 100]} onValueChange={(v) => setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], volume: v[0] / 100 } }))} className="h-1.5 flex-1" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-xl", s.muted ? "text-red-500 bg-red-500/10" : "text-muted-foreground")} onClick={() => setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], muted: !s.muted } }))}>
                      {s.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    <ChannelSettingsDialog 
                      channelIdx={chIdx} 
                      settings={s} 
                      onUpdate={(key, val) => setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], [key]: val } }))} 
                      onAudition={() => { if (selId) playClip(selId, chKey); }} 
                    />
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-red-500/40 hover:text-red-500 hover:bg-red-500/10" onClick={() => {
                      setNumChannels(p => Math.max(1, p - 1));
                      const newGrid = { ...grid };
                      Object.keys(newGrid).forEach(k => { if (k.startsWith(`${chIdx}-`)) delete newGrid[k]; });
                      setGrid(newGrid);
                    }}>
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex gap-3 h-[120px] items-center overflow-x-auto pb-4 custom-scrollbar">
                {Array.from({ length: numSteps }).map((_, stepIdx) => {
                  const clipIds = grid[`${chIdx}-${stepIdx}`] || [];
                  const clip = clips.find(c => c.id === clipIds[0]);
                  const char = CHARACTER_TYPES.find(ct => ct.id === clip?.characterType);
                  const CharIcon = char?.icon;
                  return (
                    <button key={stepIdx} onClick={() => {
                      const cid = selectedClipsForChannel[chKey]; if (!cid) return;
                      const key = `${chIdx}-${stepIdx}`; const ng = { ...grid };
                      if (ng[key]?.includes(cid)) { ng[key] = ng[key].filter(id => id !== cid); if (ng[key].length === 0) delete ng[key]; }
                      else { ng[key] = [cid]; playClip(cid, chKey); }
                      setGrid(ng);
                    }} className={cn("w-16 h-[80%] rounded-2xl transition-all duration-300 flex items-center justify-center relative shrink-0", clip ? `${s.color} shadow-2xl brightness-125 translate-y-[-4px]` : "bg-neutral-800/40 border border-white/5", stepIdx === currentStep ? "ring-4 ring-primary/40 scale-110 z-10" : "scale-100")}>
                      {CharIcon && <CharIcon className={cn("w-7 h-7", stepIdx === currentStep ? "animate-bounce text-black" : "text-black/80")} />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <Button variant="outline" className="w-full border-dashed border-2 py-12 rounded-[2.5rem] bg-black/20 border-primary/20" onClick={() => { const nextIdx = numChannels; setNumChannels(p => p + 1); setChannelSettings(p => ({ ...p, [nextIdx.toString()]: { ...DEFAULT_CHANNEL_SETTINGS, color: CHANNEL_COLORS[nextIdx % CHANNEL_COLORS.length].class } })); setSelectedClipsForChannel(p => ({ ...p, [nextIdx.toString()]: '' })); }}>
          <Plus className="w-6 h-6 text-primary mr-4" />
          <span className="font-black uppercase tracking-[0.5em] text-[11px] text-muted-foreground">ACTIVATE_NEW_SIGNAL_STREAM</span>
        </Button>
      </div>
    </div>
  );
}
