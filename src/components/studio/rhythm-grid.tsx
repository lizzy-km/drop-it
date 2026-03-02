"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Play, Square, Save, Trash2, Plus, 
  Settings, Volume2, Activity, Maximize2,
  ChevronDown, MoreHorizontal, Power, 
  BarChart3, Music2, Wand2, Download, Upload,
  ListMusic, SlidersHorizontal, MousePointer2,
  FileDown, FileUp, ChevronRight, ArrowLeftRight,
  RefreshCcw, Eraser, Dice5, MoveHorizontal
} from 'lucide-react';
import { db, User, AudioClip, Track, ChannelSettings, NoteProperty } from '@/lib/db';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { MasterVisualizer } from './visualizers';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { ChannelSettingsDialog } from './channel-settings-dialog';
import StudioHeader from './Header';

const DEFAULT_CHANNELS = 8;
const MAX_STEPS = 512;

type GraphProperty = 'velocity' | 'finePitch' | 'panOffset' | 'cutoffOffset' | 'resOffset';

const DEFAULT_CHANNEL_SETTINGS: ChannelSettings = {
  volume: 0.8, pitch: 1.0, delay: 0, reverb: 0, pan: 0, cutoff: 1.0, distortion: 0, autoTune: 0,
  color: 'bg-primary', muted: false, reversed: false,
  oscActive: true, svfActive: true, lfoActive: true, fxActive: true, ampActive: true,
  unison: 0, vibrato: 0, oscCoarse: 0, oscFine: 0, oscLevel: 1.0, oscLfo: 0, oscEnv: 0, oscPw: 0,
  ampAttack: 0.01, ampHold: 0, ampDecay: 0.1, ampSustain: 1.0, ampRelease: 0.1, ampLevel: 1.0,
  svfCut: 1.0, svfEmph: 0.2, svfEnv: 0, svfLfo: 0, svfKb: 0, svfType: 'lowpass',
  svfAttack: 0.01, svfDecay: 0.1, svfSustain: 0.5, svfRelease: 0.1,
  lfoRate: 1.0, lfoDelay: 0, limiterPre: 1.0, limiterMix: 0,
  attack: 0.01, release: 0.1, trimStart: 0, trimEnd: 1,
};

export function RhythmGrid({ user, clips, track, onSaveTrack }: {
  user: User;
  clips: AudioClip[];
  track?: Track;
  onSaveTrack: (t: Track) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(track?.bpm || 130);
  const [numSteps, setNumSteps] = useState(track?.numSteps || 16);
  const [numChannels, setNumChannels] = useState(track?.numChannels || DEFAULT_CHANNELS);
  const [grid, setGrid] = useState<Record<string, NoteProperty[]>>(track?.grid || {});
  const [title, setTitle] = useState(track?.title || 'UNNAMED_PATTERN_1');
  const [selectedChannelForGraph, setSelectedChannelForGraph] = useState(0);
  const [activeGraphProperty, setActiveGraphProperty] = useState<GraphProperty>('velocity');
  
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [lastToggledStep, setLastToggledStep] = useState<string | null>(null);

  const [channelSettings, setChannelSettings] = useState<Record<string, ChannelSettings>>(() => {
    const base: Record<string, ChannelSettings> = {};
    for (let i = 0; i < 16; i++) {
      base[i.toString()] = { ...DEFAULT_CHANNEL_SETTINGS, ...track?.channelSettings?.[i.toString()] };
    }
    return base;
  });

  const [selectedClips, setSelectedClips] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (let i = 0; i < 16; i++) {
      base[i.toString()] = track?.selectedClips?.[i.toString()] || (clips[i]?.id || '');
    }
    return base;
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const schedulerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const currentStepRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepContainerRef = useRef<HTMLDivElement>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  // Use refs to avoid interval restarts on every grid/settings change
  const gridRef = useRef(grid);
  const numStepsRef = useRef(numSteps);
  const numChannelsRef = useRef(numChannels);
  const bpmRef = useRef(bpm);
  const channelSettingsRef = useRef(channelSettings);

  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { numStepsRef.current = numSteps; }, [numSteps]);
  useEffect(() => { numChannelsRef.current = numChannels; }, [numChannels]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { channelSettingsRef.current = channelSettings; }, [channelSettings]);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(ctx.destination);
      masterAnalyserRef.current = analyser;
      audioContextRef.current = ctx;
    }
    return audioContextRef.current;
  }, []);

  const loadBuffer = async (clip: AudioClip, ctx: AudioContext) => {
    if (audioBuffersRef.current[clip.id]) return audioBuffersRef.current[clip.id];
    try {
      const res = await fetch(clip.audioData);
      const ab = await res.arrayBuffer();
      const buffer = await ctx.decodeAudioData(ab);
      audioBuffersRef.current[clip.id] = buffer;
      return buffer;
    } catch (e) { return null; }
  };

  const playNote = useCallback(async (note: NoteProperty, chIdx: string, time: number) => {
    const ctx = initAudio();
    const s = channelSettingsRef.current[chIdx] || DEFAULT_CHANNEL_SETTINGS;
    if (s.muted) return;

    const clip = clips.find(c => c.id === note.clipId);
    if (!clip) return;

    const buffer = await loadBuffer(clip, ctx);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const panNode = ctx.createStereoPanner();
    const filterNode = ctx.createBiquadFilter();

    const safeVolume = isFinite(s.volume) ? s.volume : 0.8;
    const safePan = isFinite(s.pan) ? Math.max(-1, Math.min(1, s.pan)) : 0;
    const safePitch = isFinite(s.pitch) ? Math.max(0.1, s.pitch) : 1.0;
    
    const safeVelocity = isFinite(note.velocity) ? note.velocity : 1.0;
    const safeFinePitch = isFinite(note.finePitch) ? note.finePitch : 0;
    const notePanOffset = isFinite(note.panOffset) ? note.panOffset : 0;
    const noteCutoffOffset = isFinite(note.cutoffOffset) ? note.cutoffOffset : 0;
    const noteResOffset = isFinite(note.resOffset) ? note.resOffset : 0;

    const finalPitch = safePitch * Math.pow(2, safeFinePitch / 1200);
    const finalVol = safeVelocity * safeVolume;
    const finalPan = Math.max(-1, Math.min(1, safePan + notePanOffset));

    source.buffer = buffer;
    source.playbackRate.setValueAtTime(isFinite(finalPitch) ? finalPitch : 1.0, time);
    panNode.pan.setValueAtTime(finalPan, time);
    gainNode.gain.setValueAtTime(isFinite(finalVol) ? finalVol : 0.8, time);

    if (s.svfActive) {
      filterNode.type = s.svfType || 'lowpass';
      const baseCut = isFinite(s.svfCut) ? s.svfCut : 1.0;
      const finalCut = Math.max(0, Math.min(1, baseCut + noteCutoffOffset));
      const freq = Math.max(20, Math.min(20000, 20 + (Math.pow(finalCut, 2) * 19980)));
      
      const baseRes = isFinite(s.svfEmph) ? s.svfEmph : 0.2;
      const finalRes = Math.max(0, Math.min(1, baseRes + noteResOffset));
      
      filterNode.frequency.setValueAtTime(freq, time);
      filterNode.Q.setValueAtTime(Math.max(0.0001, finalRes * 20), time);
    } else {
      filterNode.type = 'allpass';
    }

    source.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(masterAnalyserRef.current || ctx.destination);

    source.start(time);
  }, [clips, initAudio]);

  const schedule = useCallback(() => {
    const ctx = initAudio();
    const currentBpm = Math.max(20, bpmRef.current);
    const secondsPerStep = (60.0 / currentBpm) / 4;

    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      const step = currentStepRef.current;
      const stepLimit = numStepsRef.current;
      const chLimit = numChannelsRef.current;
      
      for (let ch = 0; ch < chLimit; ch++) {
        const notes = gridRef.current[`${ch}-${step}`];
        if (notes) {
          notes.forEach(n => playNote(n, ch.toString(), nextNoteTimeRef.current));
        }
      }
      
      nextNoteTimeRef.current += secondsPerStep;
      currentStepRef.current = (currentStepRef.current + 1) % stepLimit;
      
      const captureStep = step;
      setTimeout(() => setCurrentStep(captureStep), Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000));
    }
  }, [playNote, initAudio]);

  useEffect(() => {
    if (isPlaying) {
      const ctx = initAudio();
      if (ctx.state === 'suspended') ctx.resume();
      nextNoteTimeRef.current = ctx.currentTime;
      currentStepRef.current = 0;
      schedulerTimerRef.current = setInterval(schedule, 25);
    } else {
      if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
      setCurrentStep(-1);
    }
    return () => { if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current); };
  }, [isPlaying, schedule, initAudio]);

  const toggleStep = useCallback((chIdx: number, stepIdx: number, force?: boolean) => {
    const clipId = selectedClips[chIdx.toString()];
    if (!clipId) return;

    const key = `${chIdx}-${stepIdx}`;
    if (lastToggledStep === key && !force) return;
    setLastToggledStep(key);

    const current = grid[key] || [];
    const exists = current.find(n => n.clipId === clipId);

    const newGrid = { ...grid };
    if (exists) {
      newGrid[key] = current.filter(n => n.clipId !== clipId);
      if (newGrid[key].length === 0) delete newGrid[key];
    } else {
      newGrid[key] = [...current, { 
        id: crypto.randomUUID(), 
        clipId, 
        velocity: 0.8, 
        finePitch: 0,
        panOffset: 0,
        cutoffOffset: 0,
        resOffset: 0
      }];
      if (!isPlaying) {
        playNote(newGrid[key][newGrid[key].length - 1], chIdx.toString(), (audioContextRef.current?.currentTime || 0) + 0.05);
      }
    }
    setGrid(newGrid);
  }, [selectedClips, grid, isPlaying, lastToggledStep, playNote]);

  const shiftChannel = (chIdx: number, direction: 'left' | 'right') => {
    const newGrid = { ...grid };
    const temp: NoteProperty[][] = new Array(numSteps);
    for (let s = 0; s < numSteps; s++) {
      const key = `${chIdx}-${s}`;
      temp[s] = newGrid[key] ? [...newGrid[key]] : [];
      delete newGrid[key];
    }
    for (let s = 0; s < numSteps; s++) {
      let target;
      if (direction === 'left') target = (s - 1 + numSteps) % numSteps;
      else target = (s + 1) % numSteps;
      if (temp[s].length > 0) newGrid[`${chIdx}-${target}`] = temp[s];
    }
    setGrid(newGrid);
    toast({ title: `Channel Shifted ${direction.toUpperCase()}` });
  };

  const mirrorChannel = (chIdx: number) => {
    const newGrid = { ...grid };
    const temp: NoteProperty[][] = new Array(numSteps);
    for (let s = 0; s < numSteps; s++) {
      const key = `${chIdx}-${s}`;
      temp[s] = newGrid[key] ? [...newGrid[key]] : [];
      delete newGrid[key];
    }
    for (let s = 0; s < numSteps; s++) {
      const target = (numSteps - 1) - s;
      if (temp[s].length > 0) newGrid[`${chIdx}-${target}`] = temp[s];
    }
    setGrid(newGrid);
    toast({ title: "Channel Pattern Reversed" });
  };

  const humanizeChannel = (chIdx: number) => {
    const newGrid = { ...grid };
    for (let s = 0; s < numSteps; s++) {
      const key = `${chIdx}-${s}`;
      if (newGrid[key]) {
        newGrid[key] = newGrid[key].map(n => ({
          ...n,
          velocity: Math.max(0.1, Math.min(1.0, n.velocity + (Math.random() * 0.2 - 0.1)))
        }));
      }
    }
    setGrid(newGrid);
    toast({ title: "Velocity Humanized" });
  };

  const clearChannel = (chIdx: number) => {
    const newGrid = { ...grid };
    for (let s = 0; s < numSteps; s++) delete newGrid[`${chIdx}-${s}`];
    setGrid(newGrid);
    toast({ title: "Channel Cleared" });
  };

  const deleteChannel = (chIdx: number) => {
    if (numChannels <= 1) {
      toast({ title: "Operation Denied", description: "Studio requires at least one channel.", variant: "destructive" });
      return;
    }

    const newGrid: Record<string, NoteProperty[]> = {};
    Object.entries(grid).forEach(([key, value]) => {
      const parts = key.split('-');
      const ch = parseInt(parts[0]);
      const step = parts[1];
      if (ch === chIdx) return;
      const targetCh = ch > chIdx ? ch - 1 : ch;
      newGrid[`${targetCh}-${step}`] = value;
    });

    const newSettings: Record<string, ChannelSettings> = {};
    const newClips: Record<string, string> = {};

    for (let i = 0; i < numChannels; i++) {
      if (i === chIdx) continue;
      const targetIdx = i > chIdx ? i - 1 : i;
      newSettings[targetIdx.toString()] = channelSettings[i.toString()] || DEFAULT_CHANNEL_SETTINGS;
      newClips[targetIdx.toString()] = selectedClips[i.toString()] || '';
    }

    setGrid(newGrid);
    setChannelSettings(newSettings);
    setSelectedClips(newClips);
    setNumChannels(prev => prev - 1);
    
    if (selectedChannelForGraph === chIdx) {
      setSelectedChannelForGraph(Math.max(0, chIdx - 1));
    } else if (selectedChannelForGraph > chIdx) {
      setSelectedChannelForGraph(prev => prev - 1);
    }

    toast({ title: "Channel Deleted", description: `Removed track ${chIdx + 1}` });
  };

  const handleSave = () => {
    const t: Track = {
      id: track?.id || crypto.randomUUID(),
      userId: user.id,
      title, bpm, numChannels, numSteps, grid,
      channelSettings, selectedClips, createdAt: Date.now()
    };
    db.saveTrack(t);
    onSaveTrack(t);
    toast({ title: "Session Saved to Studio" });
  };

  const handleExportProject = () => {
    try {
      const currentTrack: Track = {
        id: track?.id || crypto.randomUUID(),
        userId: user.id,
        title, bpm, numChannels, numSteps, grid,
        channelSettings, selectedClips, createdAt: Date.now()
      };
      const projectData = { type: "DROPIT_PROJECT", version: "1.0", track: currentTrack };
      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_project.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
      toast({ title: "Project Exported to Disk" });
    } catch (err) {
      toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  const handleImportProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.type === "DROPIT_PROJECT") {
          const t = data.track;
          setTitle(t.title); 
          setBpm(t.bpm); 
          setNumSteps(t.numSteps); 
          setNumChannels(t.numChannels);
          setGrid(t.grid); 
          setChannelSettings(t.channelSettings); 
          setSelectedClips(t.selectedClips);
          toast({ title: "Project Loaded Successfully" });
        }
      } catch (err) {
        toast({ title: "Import Error", description: "Unsupported project schema.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRandomize = () => {
    const newGrid: Record<string, NoteProperty[]> = {};
    for (let ch = 0; ch < numChannels; ch++) {
      const clipId = selectedClips[ch.toString()];
      if (!clipId) continue;
      for (let s = 0; s < numSteps; s++) {
        if (Math.random() > 0.8) {
          newGrid[`${ch}-${s}`] = [{ id: crypto.randomUUID(), clipId, velocity: 0.6 + Math.random() * 0.4, finePitch: 0, panOffset: 0, cutoffOffset: 0, resOffset: 0 }];
        }
      }
    }
    setGrid(newGrid);
    toast({ title: "Pattern Randomly Generated" });
  };

  const changeClip = (chIdx: string, clipId: string) => {
    setSelectedClips(prev => ({ ...prev, [chIdx]: clipId }));
    const clip = clips.find(c => c.id === clipId);
    if (clip) playNote({ id: 'preview', clipId, velocity: 1, finePitch: 0, panOffset: 0, cutoffOffset: 0, resOffset: 0 }, chIdx, (audioContextRef.current?.currentTime || 0));
  };

  const getGraphValue = (stepIdx: number): number => {
    const notes = grid[`${selectedChannelForGraph}-${stepIdx}`] || [];
    if (notes.length === 0) return 0;
    const n = notes[0];
    switch (activeGraphProperty) {
      case 'velocity': return n.velocity;
      case 'finePitch': return (n.finePitch + 1200) / 2400;
      case 'panOffset': return (n.panOffset + 1) / 2;
      case 'cutoffOffset': return (n.cutoffOffset + 1) / 2;
      case 'resOffset': return (n.resOffset + 1) / 2;
      default: return 0;
    }
  };

  const updateGraphValue = (stepIdx: number, rawVal: number) => {
    const key = `${selectedChannelForGraph}-${stepIdx}`;
    const currentNotes = grid[key];
    if (!currentNotes || currentNotes.length === 0) return;
    const newGrid = { ...grid };
    newGrid[key] = currentNotes.map(n => {
      const updated = { ...n };
      switch (activeGraphProperty) {
        case 'velocity': updated.velocity = rawVal; break;
        case 'finePitch': updated.finePitch = (rawVal * 2400) - 1200; break;
        case 'panOffset': updated.panOffset = (rawVal * 2) - 1; break;
        case 'cutoffOffset': updated.cutoffOffset = (rawVal * 2) - 1; break;
        case 'resOffset': updated.resOffset = (rawVal * 2) - 1; break;
      }
      return updated;
    });
    setGrid(newGrid);
  };

  function throttle(func: Function, limit: number) {
  let inThrottle:boolean; 
  return function(...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args); 
      inThrottle = true;     

     
      setTimeout(() => inThrottle = false, limit);
    }
  }
}



  const handleSequencerScroll =throttle( (e: React.UIEvent<HTMLDivElement>) => {
    if (graphContainerRef.current) {
      // console.log("Sequencer scrolled", e.currentTarget.scrollLeft);

      graphContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, 20);

  const handleGraphScroll =throttle( (e: React.UIEvent<HTMLDivElement>) => {
    if (stepContainerRef.current) {
      // console.log("Graph scrolled", e.currentTarget.scrollLeft);
      stepContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  }, 20);

  return (
    <div 
      className="flex flex-col gap-1 h-full w-full max-w-full select-none overflow-hidden"
      onMouseUp={() => { setIsMouseDown(false); setLastToggledStep(null); }}
      onMouseLeave={() => { setIsMouseDown(false); setLastToggledStep(null); }}
    >
      <input type="file" ref={fileInputRef} onChange={handleImportProject} accept=".json" className="hidden" />
      
      {/* DAW TOOLBAR */}
      <div className="flex w-full max-w-full overflow-hidden items-center justify-start bg-[#111] border-b border-white/5 p-1 h-12 shadow-md z-50 shrink-0">
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-muted-foreground uppercase hover:bg-white/5">File</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="glass-panel border-primary/20 bg-black/90 p-1 min-w-[180px]">
              <DropdownMenuItem onClick={handleSave} className="text-[10px] font-black uppercase text-primary hover:bg-primary/10 cursor-pointer">
                <Save className="w-3 h-3 mr-2" /> Save_to_Library
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportProject} className="text-[10px] font-black uppercase text-primary hover:bg-primary/10 cursor-pointer">
                <FileDown className="w-3 h-3 mr-2" /> Export_Project_JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black uppercase text-primary hover:bg-primary/10 cursor-pointer">
                <FileUp className="w-3 h-3 mr-2" /> Import_Project_JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          {/* <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-muted-foreground uppercase hover:bg-white/5">Edit</Button> */}
          <div className="w-px h-4 bg-white/10 mx-2" />
          
          <Button 
            onClick={() => setIsPlaying(!isPlaying)}
            className={cn("h-8 w-8 rounded-sm daw-button-outer transition-all", isPlaying ? "bg-primary text-black" : "bg-muted text-muted-foreground")}
          >
            {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/5" onClick={handleRandomize}>
            <Wand2 className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-start gap-8 bg-black/40 px-6 py-1 rounded-sm border border-white/5">
           <div className="flex flex-col items-center min-w-[120px] gap-1">
              <span className="text-[8px] text-primary/60 font-black uppercase leading-none">BPM: {bpm.toFixed(1)}</span>
              <div className="flex items-center gap-2 w-full">
                <Slider value={[bpm]} min={60} max={200} step={0.1} onValueChange={(v) => setBpm(v[0])} className="flex-1" />
                <input 
                  type="number" 
                  value={bpm.toFixed(1)} 
                  onChange={(e) => setBpm(Math.max(20, parseFloat(e.target.value) || 120))}
                  className="w-10 bg-transparent text-[9px] font-bold text-primary border-none focus:ring-0 p-0 text-right"
                />
              </div>
           </div>
           <div className="w-px h-8 bg-white/10" />
           <div className="flex flex-col items-center min-w-[120px] gap-1">
              <span className="text-[8px] text-primary/60 font-black uppercase leading-none">STEPS: {numSteps}</span>
              <div className="flex items-center gap-2 w-full">
                <Slider value={[numSteps]} min={8} max={512} step={8} onValueChange={(v) => setNumSteps(v[0])} className="flex-1" />
                <input 
                  type="number" 
                  value={numSteps} 
                  onChange={(e) => setNumSteps(Math.min(MAX_STEPS, Math.max(8, parseInt(e.target.value) || 16)))}
                  className="w-8 bg-transparent text-[9px] font-bold text-primary border-none focus:ring-0 p-0 text-right"
                />
              </div>
           </div>
           <div className="w-px h-8 bg-white/10" />
           <div className="w-40 h-8">
              <MasterVisualizer analyser={masterAnalyserRef.current} />
           </div>
        </div>

        <div className="flex items-center gap-2 px-4">
           <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-primary italic uppercase tracking-tighter">{title}</span>
              <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest">MASTER_SIGNAL_ACTIVE</span>
           </div>
        </div>
      </div>

      {/* CHANNEL RACK WINDOW */}
      <div className="flex-1 flex flex-col bg-[#1e2329] rounded-sm daw-button-outer overflow-hidden m-4 border border-white/10 shadow-2xl relative">
        <div className="h-8 bg-[#2d333b] border-b border-black flex items-center justify-between px-3 shrink-0 z-30">
          <div className="flex items-center gap-2">
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
            <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_5px_rgba(255,153,0,0.5)]" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Channel Rack</span>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-white"><BarChart3 className="w-3 h-3" /></Button>
          </div>
        </div>

        {/* SEQUENCER AREA WITH STICKY HEADERS */}
        <div 
         
          className="flex w-full max-w-full overflow-x-hidden overflow-y-auto custom-scrollbar relative"
        >
          <div className="w-[270px]    max-w-[270px] overflow-hidden flex flex-col">
            {Array.from({ length: numChannels }).map((_, chIdx) => {
              const chKey = chIdx.toString();
              const s = channelSettings[chKey] || DEFAULT_CHANNEL_SETTINGS;
              const activeClipId = selectedClips[chKey];
              
              return (
                <div 
                  key={chIdx} 
                  className={cn(
                    "flex items-center gap-2 h-9 p-1 group hover:bg-white/5 cursor-pointer rounded-sm transition-colors border-b border-white/5 shrink-0", 
                    selectedChannelForGraph === chIdx ? "bg-primary/5" : ""
                  )}
                  onClick={() => setSelectedChannelForGraph(chIdx)}
                >
                  {/* STICKY CHANNEL CONTROLS */}
                  <div className="sticky left-0 flex items-center gap-2 bg-[#1e2329] z-20 pr-4 border-r border-white/5 shadow-[5px_0_10px_rgba(0,0,0,0.3)] w-[260px] shrink-0">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], muted: !s.muted }})); }}
                        className={cn("w-3 h-3 rounded-full border border-black daw-button-inner transition-colors shrink-0", s.muted ? "bg-red-900/40" : "bg-primary shadow-[0_0_6px_rgba(255,153,0,0.6)]")} 
                      />
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-muted-foreground hover:text-primary transition-colors">
                            <MoreHorizontal className="w-3 h-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="glass-panel border-primary/20 bg-black/90 p-1 min-w-[140px]">
                          <DropdownMenuItem onClick={() => shiftChannel(chIdx, 'left')} className="text-[9px] font-black uppercase text-primary/60 hover:text-primary cursor-pointer">
                            <ArrowLeftRight className="w-3 h-3 mr-2 rotate-180" /> Shift Left
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => shiftChannel(chIdx, 'right')} className="text-[9px] font-black uppercase text-primary/60 hover:text-primary cursor-pointer">
                            <ArrowLeftRight className="w-3 h-3 mr-2" /> Shift Right
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem onClick={() => mirrorChannel(chIdx)} className="text-[9px] font-black uppercase text-primary/60 hover:text-primary cursor-pointer">
                            <RefreshCcw className="w-3 h-3 mr-2" /> Reverse Pattern
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => humanizeChannel(chIdx)} className="text-[9px] font-black uppercase text-primary/60 hover:text-primary cursor-pointer">
                            <Dice5 className="w-3 h-3 mr-2" /> Humanize Velocity
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem onClick={() => clearChannel(chIdx)} className="text-[9px] font-black uppercase text-primary/60 hover:text-primary cursor-pointer">
                            <Eraser className="w-3 h-3 mr-2" /> Clear Pattern
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/5" />
                          <DropdownMenuItem onClick={() => deleteChannel(chIdx)} className="text-[9px] font-black uppercase text-destructive hover:bg-destructive/10 cursor-pointer">
                            <Trash2 className="w-3 h-3 mr-2" /> Delete Channel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="w-6 h-6 rounded-full bg-[#111] daw-button-inner flex items-center justify-center relative cursor-ns-resize group/knob"
                           title="Panning"
                           onMouseDown={(e) => {
                             const startY = e.clientY;
                             const startPan = s.pan;
                             const handleMove = (me: MouseEvent) => {
                               const delta = (startY - me.clientY) * 0.01;
                               setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], pan: Math.max(-1, Math.min(1, startPan + delta)) }}));
                             };
                             const handleUp = () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
                             window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
                           }}>
                        <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-primary/40 origin-center transition-transform" style={{ transform: `rotate(${s.pan * 150}deg)` }} />
                      </div>
                      <div className="w-6 h-6 rounded-full bg-[#111] daw-button-inner flex items-center justify-center relative cursor-ns-resize group/knob"
                           title="Volume"
                           onMouseDown={(e) => {
                             const startY = e.clientY;
                             const startVol = s.volume;
                             const handleMove = (me: MouseEvent) => {
                               const delta = (startY - me.clientY) * 0.01;
                               setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], volume: Math.max(0, Math.min(1.5, startVol + delta)) }}));
                             };
                             const handleUp = () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
                             window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
                           }}>
                        <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-primary origin-center transition-transform" style={{ transform: `rotate(${(s.volume - 0.5) * 300}deg)` }} />
                      </div>
                    </div>

                    <div className="w-32 flex items-center bg-[#2d333b] rounded-sm daw-button-outer overflow-hidden shrink-0">
                       <Select value={activeClipId} onValueChange={(val) => changeClip(chKey, val)}>
                          <SelectTrigger className="h-7 border-none bg-transparent focus:ring-0 text-[9px] font-bold uppercase p-1">
                            <SelectValue placeholder="Empty" />
                          </SelectTrigger>
                          <SelectContent className="glass-panel border-primary/20 bg-black/90">
                            {clips.map(c => (
                              <SelectItem key={c.id} value={c.id} className="text-[10px] font-bold uppercase">{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                       </Select>
                    </div>
                  </div>

                  
                </div>
              );
            })}

            <Button 
              variant="ghost" 
              className="sticky my-2 left-0 h-8 text-[9px] font-black uppercase text-muted-foreground hover:text-white hover:bg-white/5 mt-4 border border-dashed border-white/5 w-full z-20 shrink-0"
              onClick={() => setNumChannels(p => Math.min(16, p + 1))}
            >
              <Plus className="w-3 h-3 mr-2" /> Add Mixer Channel
            </Button>
          </div>

          <div
            ref={stepContainerRef}
          onScroll={handleSequencerScroll}
           className=' flex flex-col  w-[100%] items-start justify-start h-full custom-scrollbar  max-w-[800px] overflow-auto ' >
            {
              Array.from({length:numChannels}).map((_,chIdx)=>{
                const chKey = chIdx.toString();
                const s = channelSettings[chKey] || DEFAULT_CHANNEL_SETTINGS;
                const activeClipId = selectedClips[chKey];
                const activeClip = clips.find(c => c.id === activeClipId);
                return (
                  <div 
                  onClick={() => setSelectedChannelForGraph(chIdx)}

                  key={chIdx} 
                  className={cn(
                    "flex w-auto items-center gap-2 h-9 p-1 group hover:bg-white/5 cursor-pointer rounded-sm transition-colors border-b border-white/5 shrink-0", 
                    selectedChannelForGraph === chIdx ? "bg-primary/5" : ""
                  )}                   >
                    {/* SCROLLABLE STEP AREA */}
                  <div className="flex gap-1 h-full items-center pl-2 shrink-0">
                    {Array.from({ length: numSteps }).map((_, stepIdx) => {
                      const groupIdx = Math.floor(stepIdx / 4);
                      const isGroupLight = groupIdx % 2 === 0;
                      const notes = grid[`${chIdx}-${stepIdx}`] || [];
                      const isActive = notes.length > 0;
                      const isCurrent = stepIdx === currentStep;

                      return (
                        <button
                          key={stepIdx}
                          onMouseDown={(e) => { e.stopPropagation(); setIsMouseDown(true); toggleStep(chIdx, stepIdx, true); }}
                          onMouseEnter={() => { if (isMouseDown) toggleStep(chIdx, stepIdx); }}
                          className={cn(
                            "w-6 h-6 rounded-[1px] transition-all transform active:scale-95 daw-button-outer shrink-0",
                            isActive ? "step-active" : (isGroupLight ? "step-inactive-light" : "step-inactive-dark"),
                            isCurrent && "ring-1 ring-white brightness-125 scale-105 z-10 shadow-[0_0_10px_white]"
                          )}
                        />
                      );
                    })}
                  </div>

                  <div className="sticky right-0 ml-auto bg-[#1e2329] pl-2 z-10" onClick={(e) => e.stopPropagation()}>
                    <ChannelSettingsDialog 
                      channelIdx={chIdx} 
                      settings={s} 
                      onUpdate={(k, v) => setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], [k]: v }}))}
                      onBatchUpdate={(ns) => setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], ...ns }}))}
                      onAudition={() => activeClip && playNote({ 
                        id: 'audition', 
                        clipId: activeClip.id, 
                        velocity: 1, 
                        finePitch: 0,
                        panOffset: 0,
                        cutoffOffset: 0,
                        resOffset: 0
                      }, chKey, (audioContextRef.current?.currentTime || 0))}
                    />
                  </div>
                  </div>
                )
              })
            }
          </div>
        </div>

        {/* GRAPH EDITOR PANEL - SYNCHRONIZED SCROLL */}
        <div className="h-auto bg-[#1a1f25] border-t border-black p-3 flex flex-col gap-3 shadow-inner shrink-0 z-30">
           <div className="flex items-center justify-between px-2">
              <div className="flex gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                 {[
                   { id: 'velocity', label: 'Velocity', icon: Volume2 },
                   { id: 'finePitch', label: 'Pitch', icon: Music2 },
                   { id: 'panOffset', label: 'Pan', icon: MousePointer2 },
                   { id: 'cutoffOffset', label: 'Cutoff', icon: Activity },
                   { id: 'resOffset', label: 'Res', icon: SlidersHorizontal },
                 ].map((prop) => (
                   <button 
                     key={prop.id}
                     onClick={() => setActiveGraphProperty(prop.id as GraphProperty)}
                     className={cn(
                       "px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                       activeGraphProperty === prop.id ? "bg-primary text-black" : "text-muted-foreground hover:text-white hover:bg-white/5"
                     )}
                   >
                     <prop.icon className="w-3 h-3" />
                     {prop.label}
                   </button>
                 ))}
              </div>
              <div className="text-[8px] font-black text-primary/60 uppercase tracking-widest flex items-center gap-2">
                <ChevronRight className="w-3 h-3" /> CHANNEL {selectedChannelForGraph + 1} MODIFIERS
              </div>
           </div>
           
           <div 
            
             className="flex-1  ml-[265px]  w-full   relative"
           >
              <div  ref={graphContainerRef}
             onScroll={handleGraphScroll} className="flex custom-scrollbar gap-1 items-start h-[400px] w-auto max-w-[768px] px-2  overflow-y-hidden overflow-x-auto custom- "> {/* Match the sticky control section width */}
                {Array.from({ length: numSteps }).map((_, stepIdx) => {
                  const notes = grid[`${selectedChannelForGraph}-${stepIdx}`] || [];
                  const val = getGraphValue(stepIdx);
                  const isActive = notes.length > 0;
                  
                  return (
                    <div key={stepIdx} className="w-6 h-full flex flex-col justify-end group/bar relative shrink-0">
                       <div 
                          className={cn(
                            "w-full rounded-t-md transition-all  daw-button-outer cursor-ns-resize", 
                            isActive ? "bg-primary/60 group-hover/bar:bg-primary shadow-[0_0_10px_rgba(255,153,0,0.2)]" : "bg-white/5"
                          )}
                          style={{ height: `${isActive ? (val * 100) : 0}%` }}
                          onMouseDown={(e) => {
                            const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                            if (!rect) return;
                            const handleMove = (me: MouseEvent) => {
                              const raw = Math.max(0, Math.min(1, 1 - (me.clientY - rect.top) / rect.height));
                              updateGraphValue(stepIdx, raw);
                            };
                            const handleUp = () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
                            window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
                          }}
                       />
                       {stepIdx % 4 === 0 && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary/20" />}
                    </div>
                  );
                })}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}


