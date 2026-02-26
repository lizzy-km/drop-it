
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Play, Square, Music, Save, Download, Plus, Trash2,
  Loader2, Zap, Waves, Sparkles, Mic2, VolumeX, Volume2,
  RotateCcw, Scissors, Timer, Settings, Volume1, Maximize2,
  Gauge, Activity, Sliders, Repeat,
  ChevronRight, ArrowRightLeft, FastForward, Clock, FileUp, FileDown,
  Dices, ArrowLeft, ArrowRight, Copy, X, AlertTriangle
} from 'lucide-react';
import { db, User, AudioClip, Track, ChannelSettings } from '@/lib/db';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { makeDistortionCurve, audioBufferToWav } from '@/lib/audio-utils';
import { MasterVisualizer, VisualEnvelope, VisualTrim } from './visualizers';
import { CHARACTER_TYPES } from '@/components/character-icons';

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
  const [bpmInput, setBpmInput] = useState((track?.bpm || 120).toString());
  const [numSteps, setNumSteps] = useState(track?.numSteps || 16);
  const [numStepsInput, setNumStepsInput] = useState((track?.numSteps || 16).toString());
  const [numChannels, setNumChannels] = useState(track?.numChannels || DEFAULT_CHANNELS);
  const [grid, setGrid] = useState<Record<string, string[]>>(track?.grid || {});
  const [title, setTitle] = useState(track?.title || 'NEW_PROJECT_01');

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

      filterNode.frequency.setValueAtTime(200 + (Math.pow(settings.cutoff, 2) * 19800), scheduledTime || ctx.currentTime);

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
    } catch (e) {
      console.error(e);
    }
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
    const channelsToRandomize = Object.keys(selectedClipsForChannel).filter(ch => !!selectedClipsForChannel[ch]);

    if (channelsToRandomize.length === 0) {
      toast({ title: "No Clips Assigned", description: "Select a clip for at least one track first.", variant: "destructive" });
      return;
    }

    const newGrid: Record<string, string[]> = { ...grid };

    // Clear existing steps for channels being randomized
    Object.keys(newGrid).forEach(key => {
      const [ch] = key.split('-');
      if (channelsToRandomize.includes(ch)) {
        delete newGrid[key];
      }
    });

    let channelsUpdated = 0;
    channelsToRandomize.forEach(ch => {
      const clipId = selectedClipsForChannel[ch];
      for (let s = 0; s < numSteps; s++) {
        if (Math.random() > 0.8) {
          newGrid[`${ch}-${s}`] = [clipId];
        }
      }
      channelsUpdated++;
    });

    setGrid(newGrid);
    toast({ title: "Pattern Generated", description: `Updated ${channelsUpdated} active tracks.` });
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
        if (newGrid[sourceKey]) {
          newGrid[targetKey] = [...newGrid[sourceKey]];
        } else {
          delete newGrid[targetKey];
        }
      }
    }
    setGrid(newGrid);
    toast({ title: "Pattern Duplicated" });
  };

  const clearGrid = () => {
    setGrid({});
    toast({ title: "Session Cleared" });
  };

  const removeChannel = (chIdx: number) => {
    if (numChannels <= 1) {
      toast({ title: "Action Denied", description: "At least one track required.", variant: "destructive" });
      return;
    }
    const newGrid: Record<string, string[]> = {};
    const newSettings: Record<string, ChannelSettings> = {};
    const newSelectedClips: Record<string, string> = {};
    Object.keys(grid).forEach(key => {
      const [c, s] = key.split('-').map(Number);
      if (c < chIdx) newGrid[`${c}-${s}`] = grid[key];
      else if (c > chIdx) newGrid[`${c - 1}-${s}`] = grid[key];
    });
    for (let i = 0; i < numChannels; i++) {
      if (i < chIdx) {
        newSettings[i.toString()] = channelSettings[i.toString()];
        newSelectedClips[i.toString()] = selectedClipsForChannel[i.toString()];
      } else if (i > chIdx) {
        newSettings[(i - 1).toString()] = channelSettings[i.toString()];
        newSelectedClips[(i - 1).toString()] = selectedClipsForChannel[i.toString()];
      }
    }
    setGrid(newGrid);
    setChannelSettings(newSettings);
    setSelectedClipsForChannel(newSelectedClips);
    setNumChannels(prev => prev - 1);
    toast({ title: "Track Removed" });
  };

  const deleteProject = () => {
    if (track?.id) {
      db.deleteTrack(track.id);
      toast({ title: "Project Deleted" });
      window.location.href = '/browse';
    }
  };

  const updateChannelSetting = (idx: string, key: keyof ChannelSettings, val: any) => {
    setChannelSettings(p => ({ ...p, [idx]: { ...p[idx], [key]: val } }));
  };

  const handleSave = () => {
    const newTrack: Track = {
      id: track?.id || crypto.randomUUID(),
      userId: user.id,
      title,
      bpm,
      numChannels,
      numSteps,
      grid,
      channelSettings,
      selectedClips: selectedClipsForChannel,
      createdAt: Date.now()
    };
    db.saveTrack(newTrack);
    onSaveTrack(newTrack);
    toast({ title: "Project Saved" });
  };

  const handleExportConfig = () => {
    const currentTrack: Track = {
      id: track?.id || crypto.randomUUID(),
      userId: user.id,
      title,
      bpm,
      numChannels,
      numSteps,
      grid,
      channelSettings,
      selectedClips: selectedClipsForChannel,
      createdAt: Date.now()
    };
    const usedClipIds = new Set(Object.values(grid).flat());
    const usedClips = clips.filter(c => usedClipIds.has(c.id));
    const exportData = { type: "DROPIT_PROJECT", track: currentTrack, clips: usedClips };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_Config.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Config Exported" });
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.type !== "DROPIT_PROJECT") throw new Error("Invalid Format");
        data.clips.forEach((clip: AudioClip) => db.saveClip({ ...clip, userId: user.id }));
        const importedTrack = { ...data.track, userId: user.id, id: crypto.randomUUID(), title: `IMPORTED_${data.track.title}` };
        db.saveTrack(importedTrack);
        toast({ title: "Project Imported" });
        if (onImportRefresh) onImportRefresh();
        window.location.href = `/studio?id=${importedTrack.id}`;
      } catch (err) {
        toast({ title: "Import Failed", variant: "destructive" });
      }
    };
    reader.readAsText(file);
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
          if (clipIds) {
            for (const id of clipIds) {
              await playClip(id, c.toString(), timeOffset, offlineCtx);
            }
          }
        }
      }
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_Master.wav`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Audio Mastered" });
    } catch (err) {
      toast({ title: "Mastering Failed", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleBpmInputBlur = () => {
    let val = parseInt(bpmInput);
    if (isNaN(val) || val < 60) val = 60;
    else if (val > 200) val = 200;
    setBpm(val);
    setBpmInput(val.toString());
  };

  const handleStepsInputBlur = () => {
    let val = parseInt(numStepsInput);
    if (isNaN(val) || val < 4) val = 4;
    else if (val > MAX_STEPS) val = MAX_STEPS;
    setNumSteps(val);
    setNumStepsInput(val.toString());
  };

  return (
    <div className="space-y-12">
      <div className="glass-panel p-10 rounded-[3rem] gold-shadow relative overflow-hidden">
        <div className="absolute inset-0 studio-grid-bg opacity-10" />
        <div className="flex w-full flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
          <div className="flex-1 space-y-6 w-full">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.toUpperCase())}
              className="text-3xl font-black italic tracking-tighter bg-transparent border-none focus:ring-0 w-full outline-none text-primary selection:bg-white"
              placeholder="PROJECT_TITLE"
            />
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex items-center gap-4 h-[60] rounded-[2rem] px-8 py-4 border border-primary/20 flex-1 w-full bg-black/20">
                <MasterVisualizer analyser={masterAnalyserRef.current} />
                {/* <div className="flex items-center gap-2 px-4 border-r border-primary/10">
                    <Gauge className="w-5 h-5 text-primary" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-primary">Grid Tools</span>
                  </div> */}
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={randomizePattern} className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary border border-primary/10 gap-2">
                    <Dices className="w-3.5 h-3.5" /> Randomize
                  </Button>
                  <div className="flex bg-black/40 rounded-xl border border-primary/10 overflow-hidden">
                    <Button variant="ghost" size="icon" onClick={() => shiftPattern('left')} className="h-10 w-10 text-primary hover:bg-primary/20"><ArrowLeft className="w-4 h-4" /></Button>
                    <div className="flex items-center px-3 border-x border-primary/10 text-[9px] font-black text-primary/40">SHIFT</div>
                    <Button variant="ghost" size="icon" onClick={() => shiftPattern('right')} className="h-10 w-10 text-primary hover:bg-primary/20"><ArrowRight className="w-4 h-4" /></Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={mirrorPattern} className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary border border-primary/10 gap-2"><Copy className="w-3.5 h-3.5" /> Duplicate</Button>
                  <Button variant="ghost" size="sm" onClick={clearGrid} className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-500/20 gap-2"><X className="w-3.5 h-3.5" /> Clear</Button>
                </div>
              </div>
              {/* <div className="w-full md:w-64">
                  <MasterVisualizer analyser={masterAnalyserRef.current} />
               </div> */}
            </div>
          </div>


          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">BPM</span>
              <input
                type="text"
                value={bpmInput}
                onChange={(e) => setBpmInput(e.target.value)}
                onBlur={handleBpmInputBlur}
                className="bg-black/40 w-24 px-4 py-4 rounded-2xl border border-white/5 font-black text-2xl text-primary text-center outline-none"
              />
              <Slider value={[bpm]} min={60} max={200} onValueChange={(v) => { setBpm(v[0]); setBpmInput(v[0].toString()); }} className="w-32 h-1.5" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Steps</span>
              <input
                type="text"
                value={numStepsInput}
                onChange={(e) => setNumStepsInput(e.target.value)}
                onBlur={handleStepsInputBlur}
                className="bg-black/40 w-24 px-4 py-4 rounded-2xl border border-white/5 font-black text-2xl text-primary text-center outline-none"
              />
              <Slider value={[numSteps]} min={4} max={MAX_STEPS} onValueChange={(v) => { setNumSteps(v[0]); setNumStepsInput(v[0].toString()); }} className="w-32 h-1.5" />
            </div>
            <Button
              variant={isPlaying ? "destructive" : "default"}
              className={cn("w-24 h-24 rounded-[2.5rem] shadow-2xl transition-all", isPlaying ? "bg-red-500" : "bg-primary text-black")}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Square className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </Button>
            <div className="flex flex-col gap-3">
              <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary" onClick={handleSave}><Save className="w-5 h-5" /></Button>
              <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary" onClick={handleExportConfig}><FileDown className="w-5 h-5" /></Button>
              <div className="relative">
                <input type="file" accept=".json" onChange={handleImportConfig} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary pointer-events-none"><FileUp className="w-5 h-5" /></Button>
              </div>
              <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-primary/20 text-primary" onClick={handleExportAudio} disabled={isExporting}>
                {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              </Button>
              {track?.id && (
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button size="icon" className="w-12 h-12 rounded-2xl border-red-500/20 bg-red-500/10 text-red-500"><Trash2 className="w-5 h-5" /></Button></AlertDialogTrigger>
                  <AlertDialogContent className="glass-panel rounded-[2.5rem] p-12">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-3xl font-black italic text-red-500 uppercase">Confirm Delete</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground font-bold pt-4">This action will permanently delete the project session.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-10 flex gap-4">
                      <AlertDialogCancel className="h-14 rounded-full font-black uppercase bg-white/5 flex-1">Abort</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteProject} className="h-14 rounded-full font-black uppercase bg-red-500 flex-1">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel flex-col bg-slate-200 w-full h-full flex justify-between items-start rounded-[3rem] p-12 gold-shadow   bg-black/40">
        <div className=' w-full h-full p-3 flex justify-between ' >
          <div className=' min-w-[35%] w-[35%] justify-start items-start  h-full  border-r flex flex-col p-3 ' >
            {Array.from({ length: numChannels }).map((_, chIdx) => {
              const chKey = chIdx.toString();
              const s = channelSettings[chKey] || DEFAULT_CHANNEL_SETTINGS;
              const selId = selectedClipsForChannel[chKey] || '';
              const isActive = chIdx.toString() === "0" && currentStep !== -1;
              return (
                <div key={chIdx} className={cn("flex   h-[148px] items-center gap-8 transition-all duration-500", isActive ? "translate-x-2" : "")}>
                  <div className={cn("w-full shrink-0 bg-neutral-900/60 p-3 rounded-[2.5rem] flex items-center gap-6 border border-white/5", isActive ? "border-primary/40 bg-primary/5" : "")}>
                    <button
                      onClick={() => { if (selId) playClip(selId, chKey); }}
                      className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all shadow-2xl shrink-0", s.muted ? "bg-neutral-800" : s.color)}
                    >
                      <Music className={cn("w-8 h-8", s.muted ? "text-muted-foreground" : "text-black")} />
                    </button>
                    <div className="flex-1 space-y-4 min-w-0">
                      <select
                        className="w-full bg-transparent text-[11px] font-black uppercase text-primary outline-none cursor-pointer truncate"
                        value={selId}
                        onChange={(e) => setSelectedClipsForChannel(p => ({ ...p, [chKey]: e.target.value }))}
                      >
                        <option value="" className="bg-black">SELECT_SIGNAL</option>
                        {clips.map(c => <option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
                      </select>
                      <div className="flex items-center gap-4">
                        <Volume1 className="w-3.5 h-3.5 text-muted-foreground" />
                        <Slider value={[s.volume * 100]} min={0} max={100} onValueChange={(v) => updateChannelSetting(chKey, 'volume', v[0] / 100)} className="h-1.5 flex-1" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-xl", s.muted ? "text-red-500 bg-red-500/10" : "text-muted-foreground")} onClick={() => updateChannelSetting(chKey, 'muted', !s.muted)}>
                          {s.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary/40"><Sliders className="w-5 h-5" /></Button></DialogTrigger>
                          <DialogContent className="max-w-4xl glass-panel rounded-[3rem] p-12">
                            <DialogHeader>
                              <DialogTitle className="text-4xl font-black italic text-primary uppercase flex items-center justify-between">
                                <div className="flex items-center gap-4"><Maximize2 className="w-8 h-8" /> Sampler Lab</div>
                                <span className="text-[10px] tracking-[0.4em] font-black text-primary/40">Track_{chIdx}</span>
                              </DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 py-10 max-h-[60vh] overflow-y-scroll pr-4">
                              <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative h-auto">
                                <div className="flex justify-between items-center">
                                  <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Signal Modifiers</h4>
                                  <div className="flex items-center gap-3">
                                    <Label className="text-[9px] font-black uppercase">Reverse</Label>
                                    <Switch checked={s.reversed} onCheckedChange={(v) => updateChannelSetting(chKey, 'reversed', v)} />
                                  </div>
                                </div>
                                <VisualTrim start={s.trimStart} end={s.trimEnd} />
                                <div className="space-y-6">
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground"><span>Trim Start</span><span className="text-primary">{Math.round(s.trimStart * 100)}%</span></div>
                                    <Slider value={[s.trimStart * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'trimStart', v[0] / 100)} />
                                  </div>
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground"><span>Trim End</span><span className="text-primary">{Math.round(s.trimEnd * 100)}%</span></div>
                                    <Slider value={[s.trimEnd * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'trimEnd', v[0] / 100)} />
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative">
                                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Envelope Dynamics</h4>
                                <VisualEnvelope attack={s.attack} release={s.release} />
                                <div className="space-y-6">
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground"><span>Attack</span><span className="text-primary">{s.attack.toFixed(2)}s</span></div>
                                    <Slider value={[s.attack * 100]} max={200} onValueChange={(v) => updateChannelSetting(chKey, 'attack', v[0] / 100)} />
                                  </div>
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground"><span>Release</span><span className="text-primary">{s.release.toFixed(2)}s</span></div>
                                    <Slider value={[s.release * 100]} max={200} onValueChange={(v) => updateChannelSetting(chKey, 'release', v[0] / 100)} />
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative">
                                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Harmonics</h4>
                                <div className="space-y-6">
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground"><span>Pitch</span><span className="text-primary">{s.pitch.toFixed(2)}x</span></div>
                                    <Slider value={[s.pitch * 50]} min={25} max={200} onValueChange={(v) => updateChannelSetting(chKey, 'pitch', v[0] / 50)} />
                                  </div>
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground"><span>Cutoff</span><span className="text-primary">{Math.round(s.cutoff * 100)}%</span></div>
                                    <Slider value={[s.cutoff * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'cutoff', v[0] / 100)} />
                                  </div>
                                </div>
                              </div>
                              {/* Spatial Field */}
                              <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative group">
                                <div className="absolute top-0 right-0 p-4">
                                  <ArrowRightLeft className="w-4 h-4 text-primary/10 group-hover:text-primary/40 transition-colors" />
                                </div>
                                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Spatial_Field</h4>
                                <div className="space-y-6">
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                      <span>Panning</span>
                                      <span className="text-primary">{s.pan.toFixed(2)}</span>
                                    </div>
                                    <Slider value={[s.pan * 50 + 50]} min={0} max={100} onValueChange={(v) => updateChannelSetting(chKey, 'pan', (v[0] - 50) / 50)} />
                                  </div>
                                  <div className="space-y-3">
                                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                      <span>Delay_Send</span>
                                      <span className="text-primary">{Math.round(s.delay * 100)}%</span>
                                    </div>
                                    <Slider value={[s.delay * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'delay', v[0] / 100)} />
                                  </div>

                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-red-500/40" onClick={() => removeChannel(chIdx)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>


          <div className=" h-full  pl-3 max-w-[64%] justify-between items-start  overflow-x-auto min-w-[60%] flex-col ">
            {
              Array.from({ length: numChannels }).map((_, chIdx) => {
                const chKey = chIdx.toString();
                const s = channelSettings[chKey] || DEFAULT_CHANNEL_SETTINGS;
                const selId = selectedClipsForChannel[chKey] || '';
                const isActive = chIdx.toString() === "0" && currentStep !== -1;

                return <div className=' flex  items-end justify-start  gap-3 h-[150px]  w-auto  ' >{Array.from({ length: numSteps }).map((_, stepIdx) => {
                  const clipIds = grid[`${chIdx}-${stepIdx}`] || [];
                  const clip = clips.find(c => c.id === clipIds[0]);
                  const char = CHARACTER_TYPES.find(ct => ct.id === clip?.characterType);
                  const CharIcon = char?.icon;
                  const isCurrent = stepIdx === currentStep;
                  return (
                    <button
                      key={stepIdx}
                      onClick={() => {
                        const cid = selectedClipsForChannel[chKey];
                        if (!cid) return;
                        const key = `${chIdx}-${stepIdx}`;
                        const ng = { ...grid };
                        if (ng[key]?.includes(cid)) {
                          ng[key] = ng[key].filter(id => id !== cid);
                          if (ng[key].length === 0) delete ng[key];
                        } else {
                          ng[key] = [cid];
                          playClip(cid, chKey);
                        }
                        setGrid(ng);
                      }}
                      className={cn(
                        "w-16 h-[80%] rounded-2xl transition-all duration-300 flex items-center justify-center relative shrink-0",
                        clip ? `${s.color} shadow-2xl brightness-125` : "bg-neutral-800/40 border border-white/5",
                        isCurrent ? "ring-4 ring-primary/40 scale-110 z-10" : "scale-100"
                      )}
                    >
                      {CharIcon && <CharIcon className={cn("w-7 h-7 text-black")} />}
                      {stepIdx % 4 === 0 && !clip && <div className="absolute bottom-2 w-1 h-1 bg-white/20 rounded-full" />}
                    </button>
                  );
                })}</div>
              }

              )
            }

          </div>
        </div>

        <Button
          variant="outline"
          className="w-full border-dashed border-2 py-12 rounded-[2.5rem] gap-4 bg-black/20 border-primary/20 hover:bg-primary/5 group"
          onClick={() => {
            const nextIdx = numChannels;
            setNumChannels(prev => prev + 1);
            setChannelSettings(prev => ({ ...prev, [nextIdx.toString()]: { ...DEFAULT_CHANNEL_SETTINGS, color: CHANNEL_COLORS[nextIdx % CHANNEL_COLORS.length].class } }));
            setSelectedClipsForChannel(prev => ({ ...prev, [nextIdx.toString()]: '' }));
          }}
        >
          <Plus className="w-6 h-6 text-primary" /><span className="font-black uppercase tracking-[0.5em] text-[11px] text-muted-foreground">ADD_TRACK</span>
        </Button>
      </div>
    </div>
  );
}
