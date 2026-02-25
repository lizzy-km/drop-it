
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Play, Square, Music, Save, Download, Plus, Trash2, 
  Loader2, Zap, Waves, Sparkles, Mic2, VolumeX, Volume2, 
  RotateCcw, Scissors, Timer, Settings, Volume1, Maximize2, 
  Gauge, BrainCircuit, Wand2, Activity, Sliders, Repeat,
  ChevronRight, ArrowRightLeft, FastForward, Clock
} from 'lucide-react';
import { db, User, AudioClip, Track, ChannelSettings } from '@/lib/db';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { generateBeat } from '@/ai/flows/generate-beat-flow';

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

// --- KINETIC VISUAL COMPONENTS ---

const VisualEnvelope = ({ attack, release }: { attack: number, release: number }) => {
  const a = (attack / 2) * 100;
  const r = (release / 2) * 100;
  
  return (
    <div className="h-32 w-full bg-black/60 rounded-[2rem] border border-primary/10 overflow-hidden relative shadow-inner">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="env-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path 
          d={`M 0 100 L ${a} 0 L ${100 - r} 0 L 100 100 Z`}
          fill="url(#env-grad)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          className="transition-all duration-500 ease-out"
        />
        <circle cx={a} cy="0" r="2" fill="white" className="animate-pulse" />
        <circle cx={100 - r} cy="0" r="2" fill="white" className="animate-pulse" />
      </svg>
      <div className="absolute bottom-2 left-4 text-[8px] font-black uppercase text-primary/40 tracking-widest">Envelope_A/R</div>
    </div>
  );
};

const VisualTrim = ({ start, end }: { start: number, end: number }) => {
  return (
    <div className="h-24 w-full bg-black/60 rounded-[2rem] border border-primary/10 overflow-hidden relative shadow-inner group">
      <div className="absolute inset-0 opacity-20 flex items-center justify-around pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-0.5 bg-primary" style={{ height: `${20 + Math.random() * 60}%` }} />
        ))}
      </div>
      <div 
        className="absolute h-full bg-primary/20 border-x border-primary/60 transition-all duration-300"
        style={{ left: `${start * 100}%`, right: `${(1 - end) * 100}%` }}
      >
        <div className="absolute inset-0 studio-grid-bg opacity-30" />
      </div>
      <div className="absolute bottom-2 left-4 text-[8px] font-black uppercase text-primary/40 tracking-widest">Trim_Slice</div>
    </div>
  );
};

const MasterVisualizer = ({ analyser }: { analyser: AnalyserNode | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, 'rgba(250, 204, 21, 0.1)');
        gradient.addColorStop(1, 'rgba(250, 204, 21, 0.8)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        if (dataArray[i] > 200) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = 'rgba(250, 204, 21, 0.5)';
        } else {
          ctx.shadowBlur = 0;
        }

        x += barWidth + 1;
      }
    };

    draw();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [analyser]);

  return (
    <div className="h-24 w-full bg-black/40 rounded-[2rem] overflow-hidden border border-primary/10 relative shadow-inner">
      <canvas ref={canvasRef} width={800} height={100} className="w-full h-full" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <Activity className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
};

// --- MAIN RHYTHM COMPONENT ---

export function RhythmGrid({ user, clips, track }: {
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
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
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
  
  const nextNoteTimeRef = useRef<number>(0);
  const currentStepRef = useRef<number>(0);
  const lookAheadTime = 0.1; // 100ms lookahead
  const scheduleInterval = 25; // 25ms polling

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

  const loadAudio = useCallback(async (clip: AudioClip) => {
    if (audioBuffersRef.current[clip.id]) return audioBuffersRef.current[clip.id];
    const ctx = initAudioContext();
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

  const makeDistortionCurve = (amount: number) => {
    const k = amount * 100;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  };

  const playClip = useCallback(async (clipId: string, channelIdx: string, scheduledTime?: number) => {
    const settings = channelSettings[channelIdx] || DEFAULT_CHANNEL_SETTINGS;
    if (settings.muted && !scheduledTime) return;

    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    try {
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();
      let buffer = await loadAudio(clip);
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

      const startTime = scheduledTime || ctx.currentTime;
      const duration = (buffer.duration * (settings.trimEnd - settings.trimStart)) / playbackRate;
      const trimStartOffset = settings.trimStart * buffer.duration;

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(settings.volume, startTime + settings.attack);
      gainNode.gain.setValueAtTime(settings.volume, Math.max(startTime + duration - settings.release, startTime + settings.attack));
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      // Effects Routing
      source.connect(filterNode);
      filterNode.connect(distortionNode);
      
      if (settings.distortion > 0) {
        distortionNode.curve = makeDistortionCurve(settings.distortion);
      }

      distortionNode.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(masterAnalyserRef.current || ctx.destination);

      // Simple Delay Logic (Neural Space)
      if (settings.delay > 0) {
        delayNode.delayTime.value = 0.25; // 1/4 note approx
        delayGain.gain.value = settings.delay * 0.5;
        panNode.connect(delayNode);
        delayNode.connect(delayGain);
        delayGain.connect(delayNode);
        delayGain.connect(masterAnalyserRef.current || ctx.destination);
      }

      source.start(startTime, trimStartOffset, duration);
    } catch (e) {
      console.error(e);
    }
  }, [clips, loadAudio, initAudioContext, channelSettings]);

  // High-Precision Scheduler
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
      
      // Update UI (approximately)
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

  const updateChannelSetting = (idx: string, key: keyof ChannelSettings, val: any) => {
    setChannelSettings(p => ({ ...p, [idx]: { ...p[idx], [key]: val } }));
  };

  const handleAiCompose = async () => {
    if (!aiPrompt || clips.length === 0) {
      toast({ title: "Signal Missing", description: "Record sounds for the Architect to analyze." });
      return;
    }
    setIsAiLoading(true);
    try {
      const res = await generateBeat({ prompt: aiPrompt, availableClips: clips.map(c => ({ id: c.id, name: c.name })), numChannels, numSteps });
      setGrid(res.grid);
      setBpm(res.bpm);
      setTitle(res.title.toUpperCase());
      toast({ title: "Neural Pattern Manifested", className: "bg-primary text-black font-black" });
    } catch (e) {
      toast({ title: "Synthesis Error", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
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
    toast({ title: "Session Synchronized", description: `${title} has been archived.` });
  };

  return (
    <div className="space-y-12">
      <div className="glass-panel p-10 rounded-[3rem] gold-shadow relative overflow-hidden group">
        <div className="absolute inset-0 studio-grid-bg opacity-10" />
        
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 relative z-10">
          <div className="flex-1 space-y-6 w-full">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value.toUpperCase())}
              className="text-6xl font-black italic tracking-tighter bg-transparent border-none focus:ring-0 w-full outline-none text-primary selection:bg-white"
              placeholder="PROJECT_ID"
            />
            
            <div className="flex flex-col md:flex-row items-center gap-8">
               <div className="flex items-center gap-4 bg-black/60 rounded-[2rem] px-8 py-4 border border-primary/20 flex-1 w-full ai-glow-input">
                  <BrainCircuit className="w-6 h-6 text-primary animate-pulse" />
                  <input 
                    placeholder="DESCRIBE_THE_VIBE..."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs font-black uppercase tracking-[0.3em] text-primary w-full placeholder:text-primary/20"
                  />
                  <Button 
                    variant="ghost" 
                    onClick={handleAiCompose}
                    disabled={isAiLoading}
                    className="h-10 px-6 rounded-full text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-black border border-primary/20"
                  >
                    {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "SYNTHESIZE"}
                  </Button>
               </div>
               <div className="w-full md:w-64">
                  <MasterVisualizer analyser={masterAnalyserRef.current} />
               </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center gap-2">
               <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">TEMPO</span>
               <div className="bg-black/40 px-6 py-4 rounded-2xl border border-white/5 font-black text-2xl text-primary">{bpm}</div>
               <Slider value={[bpm]} min={60} max={200} onValueChange={(v) => setBpm(v[0])} className="w-32 h-1.5" />
            </div>
            
            <Button
              variant={isPlaying ? "destructive" : "default"}
              className={cn(
                "w-24 h-24 rounded-[2.5rem] shadow-2xl transition-all hover:scale-110 active:scale-95",
                isPlaying ? "bg-red-500 animate-pulse-gold" : "bg-primary text-black"
              )}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Square className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
            </Button>

            <div className="flex flex-col gap-3">
               <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary hover:bg-primary/10" onClick={handleSave}>
                 <Save className="w-5 h-5" />
               </Button>
               <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary hover:bg-primary/10" onClick={() => toast({ title: "Mastering Signal...", description: "Exporting high-fidelity WAV." })}>
                 <Download className="w-5 h-5" />
               </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-[3rem] p-12 gold-shadow overflow-x-auto space-y-8 bg-black/40">
        {Array.from({ length: numChannels }).map((_, chIdx) => {
          const chKey = chIdx.toString();
          const s = channelSettings[chKey] || DEFAULT_CHANNEL_SETTINGS;
          const selId = selectedClipsForChannel[chKey] || '';
          const isActive = chIdx.toString() === "0" && currentStep !== -1; // Visualization only

          return (
            <div key={chIdx} className={cn("flex items-center gap-8 transition-all duration-500", isActive ? "translate-x-2" : "")}>
              <div className={cn(
                "w-[460px] shrink-0 bg-neutral-900/60 p-6 rounded-[2.5rem] flex items-center gap-6 border border-white/5 transition-all duration-300",
                isActive ? "border-primary/40 bg-primary/5 shadow-lg" : ""
              )}>
                <button
                  onClick={() => { if (selId) playClip(selId, chKey); }}
                  className={cn(
                    "w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all active:scale-90 shadow-2xl shrink-0",
                    s.muted ? "bg-neutral-800" : s.color
                  )}
                >
                  <Music className={cn("w-8 h-8", s.muted ? "text-muted-foreground" : "text-black")} />
                </button>

                <div className="flex-1 space-y-4 min-w-0">
                  <select
                    className="w-full bg-transparent text-[11px] font-black uppercase tracking-[0.2em] text-primary outline-none cursor-pointer truncate"
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
                   <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-xl", s.muted ? "text-red-500 bg-red-500/10" : "text-muted-foreground")} onClick={() => updateChannelSetting(chKey, 'muted', !s.muted)}>
                     {s.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                   </Button>
                   
                   <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary/40 hover:text-primary"><Sliders className="w-5 h-5" /></Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl glass-panel border-primary/20 rounded-[3rem] p-12 gold-shadow">
                       <DialogHeader>
                          <DialogTitle className="text-4xl font-black italic text-primary tracking-tighter uppercase flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <Maximize2 className="w-8 h-8" /> Sampler_Lab
                            </div>
                            <span className="text-[10px] tracking-[0.4em] font-black text-primary/40">Channel_{chIdx}</span>
                          </DialogTitle>
                       </DialogHeader>
                       
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-10 py-10 max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
                          {/* Modifiers Section */}
                          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-4">
                                <Waves className="w-4 h-4 text-primary/10 group-hover:text-primary/40 transition-colors" />
                             </div>
                             <div className="flex justify-between items-center">
                               <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Signal_Modifiers</h4>
                               <div className="flex items-center gap-3">
                                  <Label className="text-[9px] font-black uppercase">Reverse</Label>
                                  <Switch checked={s.reversed} onCheckedChange={(v) => updateChannelSetting(chKey, 'reversed', v)} />
                               </div>
                             </div>

                             <VisualTrim start={s.trimStart} end={s.trimEnd} />

                             <div className="space-y-6">
                                <div className="space-y-3">
                                   <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                      <span>Trim_Start</span>
                                      <span className="text-primary">{Math.round(s.trimStart * 100)}%</span>
                                   </div>
                                   <Slider value={[s.trimStart * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'trimStart', v[0] / 100)} />
                                </div>
                                <div className="space-y-3">
                                   <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                      <span>Trim_End</span>
                                      <span className="text-primary">{Math.round(s.trimEnd * 100)}%</span>
                                   </div>
                                   <Slider value={[s.trimEnd * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'trimEnd', v[0] / 100)} />
                                </div>
                                <div className="space-y-3">
                                   <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                      <span>Auto_Tune</span>
                                      <span className="text-primary">{Math.round(s.autoTune * 100)}%</span>
                                   </div>
                                   <Slider value={[s.autoTune * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'autoTune', v[0] / 100)} />
                                </div>
                             </div>
                          </div>

                          {/* Envelope Section */}
                          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-4">
                                <Timer className="w-4 h-4 text-primary/10 group-hover:text-primary/40 transition-colors" />
                             </div>
                             <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Envelope_Dynamics</h4>
                             
                             <VisualEnvelope attack={s.attack} release={s.release} />

                             <div className="space-y-6">
                                <div className="space-y-3">
                                   <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                      <span>Attack</span>
                                      <span className="text-primary">{s.attack.toFixed(2)}s</span>
                                   </div>
                                   <Slider value={[s.attack * 100]} max={200} onValueChange={(v) => updateChannelSetting(chKey, 'attack', v[0] / 100)} />
                                </div>
                                <div className="space-y-3">
                                   <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                      <span>Release</span>
                                      <span className="text-primary">{s.release.toFixed(2)}s</span>
                                   </div>
                                   <Slider value={[s.release * 100]} max={200} onValueChange={(v) => updateChannelSetting(chKey, 'release', v[0] / 100)} />
                                </div>
                             </div>
                          </div>

                          {/* Sound Shaping Section */}
                          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative overflow-hidden group">
                             <div className="absolute top-0 right-0 p-4">
                                <Sparkles className="w-4 h-4 text-primary/10 group-hover:text-primary/40 transition-colors" />
                             </div>
                             <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Harmonics</h4>
                             <div className="space-y-6">
                                <div className="space-y-3">
                                   <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                      <span>Pitch</span>
                                      <span className="text-primary">{s.pitch.toFixed(2)}x</span>
                                   </div>
                                   <Slider value={[s.pitch * 50]} min={25} max={200} onValueChange={(v) => updateChannelSetting(chKey, 'pitch', v[0] / 50)} />
                                </div>
                                <div className="space-y-3">
                                   <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                      <span>Cutoff</span>
                                      <span className="text-primary">{Math.round(s.cutoff * 100)}%</span>
                                   </div>
                                   <Slider value={[s.cutoff * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'cutoff', v[0] / 100)} />
                                </div>
                                <div className="space-y-3">
                                   <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                                      <span>Distortion</span>
                                      <span className="text-primary">{Math.round(s.distortion * 100)}%</span>
                                   </div>
                                   <Slider value={[s.distortion * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'distortion', v[0] / 100)} />
                                </div>
                             </div>
                          </div>

                          {/* Spatial Section */}
                          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative overflow-hidden group">
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
                                <div className="pt-6">
                                   <Button 
                                      className="w-full h-20 rounded-[1.5rem] bg-primary text-black font-black uppercase tracking-[0.3em] hover:bg-primary/90 shadow-2xl transition-all"
                                      onClick={() => { if (selId) playClip(selId, chKey); }}
                                   >
                                      <Play className="w-6 h-6 mr-3 fill-current" /> Audition_Signal
                                   </Button>
                                </div>
                             </div>
                          </div>
                       </div>
                       
                       <DialogFooter className="pt-8 border-t border-white/5">
                          <Button 
                            className="w-full h-14 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-primary hover:text-black transition-all"
                            onClick={() => toast({ title: "Neural Synchronization Complete" })}
                          >
                             Commit_Changes
                          </Button>
                       </DialogFooter>
                    </DialogContent>
                   </Dialog>
                </div>
              </div>

              <div className="flex-1 flex gap-3 h-20 items-center overflow-x-auto pb-4 custom-scrollbar">
                {Array.from({ length: numSteps }).map((_, stepIdx) => {
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
                        "w-16 h-full rounded-2xl transition-all duration-300 flex items-center justify-center relative shrink-0",
                        clip ? `${s.color} shadow-2xl brightness-125 translate-y-[-4px]` : "bg-neutral-800/40 hover:bg-neutral-700/60 border border-white/5",
                        isCurrent ? "ring-4 ring-primary/40 scale-110 z-10" : "scale-100"
                      )}
                    >
                      {CharIcon && <CharIcon className={cn("w-7 h-7", isCurrent ? "animate-bounce text-black" : "text-black/80")} />}
                      {isCurrent && <div className="absolute inset-0 bg-primary/10 animate-pulse pointer-events-none rounded-2xl" />}
                      {stepIdx % 4 === 0 && !clip && <div className="absolute bottom-2 w-1 h-1 bg-white/20 rounded-full" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <Button 
          variant="outline" 
          className="w-full border-dashed border-2 py-12 rounded-[2.5rem] gap-4 bg-black/20 border-primary/20 hover:border-primary/60 hover:bg-primary/5 transition-all group" 
          onClick={() => {
            const nextIdx = numChannels;
            setNumChannels(prev => prev + 1);
            setChannelSettings(prev => ({ ...prev, [nextIdx.toString()]: { ...DEFAULT_CHANNEL_SETTINGS, color: CHANNEL_COLORS[nextIdx % CHANNEL_COLORS.length].class } }));
            setSelectedClipsForChannel(prev => ({ ...prev, [nextIdx.toString()]: '' }));
          }}
        >
          <Plus className="w-6 h-6 text-primary group-hover:rotate-90 transition-transform duration-500" />
          <span className="font-black uppercase tracking-[0.5em] text-[11px] text-muted-foreground group-hover:text-primary">ACTIVATE_NEW_SIGNAL_STREAM</span>
        </Button>
      </div>
    </div>
  );
}
