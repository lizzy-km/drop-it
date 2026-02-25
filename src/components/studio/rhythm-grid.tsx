"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Play, Square, Music, Save, Download, Plus, Trash2, 
  Loader2, Zap, Waves, Sparkles, Mic2, VolumeX, Volume2, 
  RotateCcw, Scissors, Timer, Settings, Volume1, Maximize2, 
  Gauge, BrainCircuit, Wand2, Activity
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

// Canvas Visualizer Component
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
        ctx.fillStyle = `rgba(250, 204, 21, ${dataArray[i] / 255})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [analyser]);

  return (
    <div className="h-24 w-full bg-black/40 rounded-[2rem] overflow-hidden border border-primary/10 relative shadow-inner">
      <canvas ref={canvasRef} width={800} height={100} className="w-full h-full opacity-60" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Activity className="w-4 h-4 text-primary/20" />
      </div>
    </div>
  );
};

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
  const [isExporting, setIsExporting] = useState(false);
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

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const reversedBuffersRef = useRef<Record<string, AudioBuffer>>({});

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, ctx.currentTime);
      compressor.ratio.setValueAtTime(4, ctx.currentTime);
      
      const masterGain = ctx.createGain();
      masterGain.gain.value = 1.2;

      compressor.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);
      
      masterAnalyserRef.current = analyser;
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
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [initAudioContext]);

  const playClip = useCallback(async (clipId: string, channelIdx: string, manualTime?: number) => {
    const settings = channelSettings[channelIdx] || DEFAULT_CHANNEL_SETTINGS;
    if (settings.muted && !manualTime) return;

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
          for (let i = 0; i < buffer.numberOfChannels; i++) {
            const data = buffer.getChannelData(i);
            const revData = rev.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) revData[j] = data[buffer.length - 1 - j];
          }
          reversedBuffersRef.current[clipId] = rev;
        }
        buffer = reversedBuffersRef.current[clipId];
      }

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const panNode = ctx.createStereoPanner();
      const filterNode = ctx.createBiquadFilter();
      
      source.buffer = buffer;
      source.playbackRate.value = settings.pitch;
      panNode.pan.value = settings.pan;
      filterNode.frequency.value = 200 + (Math.pow(settings.cutoff, 2) * 19800);

      const startTime = manualTime || ctx.currentTime;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(settings.volume, startTime + settings.attack);
      
      const duration = buffer.duration / settings.pitch;
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      source.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(masterAnalyserRef.current?.parentElement || ctx.destination);

      source.start(startTime);
    } catch (e) {
      console.error(e);
    }
  }, [clips, loadAudio, initAudioContext, channelSettings]);

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

  useEffect(() => {
    if (isPlaying) {
      const stepInterval = (60 / bpm) / 4 * 1000;
      timerRef.current = setInterval(() => {
        setCurrentStep(prev => {
          const next = (prev + 1) % numSteps;
          for (let c = 0; c < numChannels; c++) {
            const clipIds = grid[`${c}-${next}`];
            if (clipIds) clipIds.forEach(id => playClip(id, c.toString()));
          }
          return next;
        });
      }, stepInterval);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, bpm, grid, playClip, numChannels, numSteps]);

  const updateChannelSetting = (idx: number, key: keyof ChannelSettings, val: any) => {
    setChannelSettings(p => ({ ...p, [idx.toString()]: { ...p[idx.toString()], [key]: val } }));
  };

  return (
    <div className="space-y-12">
      {/* Cinematic Control Hub */}
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
                    {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "SYNTESIZE"}
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
               <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary hover:bg-primary/10" onClick={() => {
                 db.saveTrack({ id: track?.id || crypto.randomUUID(), userId: user.id, title, bpm, numChannels, numSteps, grid, channelSettings, selectedClips: selectedClipsForChannel, createdAt: Date.now() });
                 toast({ title: "Session Synchronized" });
               }}>
                 <Save className="w-5 h-5" />
               </Button>
               <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary hover:bg-primary/10" onClick={() => toast({ title: "Exporting High-Fidelity Signal..." })}>
                 <Download className="w-5 h-5" />
               </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Kinetic Sequencer Engine */}
      <div className="glass-panel rounded-[3rem] p-12 gold-shadow overflow-x-auto space-y-8 bg-black/40">
        {Array.from({ length: numChannels }).map((_, chIdx) => {
          const s = channelSettings[chIdx.toString()] || DEFAULT_CHANNEL_SETTINGS;
          const selId = selectedClipsForChannel[chIdx.toString()] || '';
          const isActive = grid[`${chIdx}-${currentStep}`];

          return (
            <div key={chIdx} className={cn("flex items-center gap-8 transition-all duration-500", isActive ? "translate-x-2" : "")}>
              <div className={cn(
                "w-[420px] shrink-0 bg-neutral-900/60 p-6 rounded-[2.5rem] flex items-center gap-6 border border-white/5 transition-all duration-300",
                isActive ? "border-primary/40 bg-primary/5 shadow-lg" : ""
              )}>
                <button
                  onClick={() => { if (selId) playClip(selId, chIdx.toString()); }}
                  className={cn(
                    "w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all active:scale-90 shadow-2xl",
                    s.muted ? "bg-neutral-800" : s.color,
                    isActive ? "scale-110 brightness-125" : ""
                  )}
                >
                  <Music className={cn("w-8 h-8", s.muted ? "text-muted-foreground" : "text-black")} />
                </button>

                <div className="flex-1 space-y-4">
                  <select
                    className="w-full bg-transparent text-[11px] font-black uppercase tracking-[0.2em] text-primary outline-none cursor-pointer"
                    value={selId}
                    onChange={(e) => setSelectedClipsForChannel(p => ({ ...p, [chIdx.toString()]: e.target.value }))}
                  >
                    <option value="" className="bg-black">SELECT_SIGNAL</option>
                    {clips.map(c => <option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
                  </select>
                  <div className="flex items-center gap-4">
                     <Volume1 className="w-3.5 h-3.5 text-muted-foreground" />
                     <Slider value={[s.volume * 100]} min={0} max={100} onValueChange={(v) => updateChannelSetting(chIdx, 'volume', v[0] / 100)} className="h-1.5 flex-1" />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                   <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-xl", s.muted ? "text-red-500 bg-red-500/10" : "text-muted-foreground")} onClick={() => updateChannelSetting(chIdx, 'muted', !s.muted)}>
                     {s.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                   </Button>
                   <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary/40 hover:text-primary"><Maximize2 className="w-4 h-4" /></Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl glass-panel border-primary/20 rounded-[3rem] p-12">
                       <DialogHeader><DialogTitle className="text-4xl font-black italic text-primary">SAMPLER_LAB</DialogTitle></DialogHeader>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-10 py-10">
                          <div className="space-y-8 bg-black/40 p-8 rounded-[2rem] border border-white/5">
                             <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">ENVELOPE</h4>
                             <div className="space-y-6">
                                <div className="space-y-2">
                                   <label className="text-[9px] font-black text-muted-foreground uppercase">Attack</label>
                                   <Slider value={[s.attack * 100]} onValueChange={(v) => updateChannelSetting(chIdx, 'attack', v[0] / 100)} />
                                </div>
                                <div className="space-y-2">
                                   <label className="text-[9px] font-black text-muted-foreground uppercase">Release</label>
                                   <Slider value={[s.release * 100]} onValueChange={(v) => updateChannelSetting(chIdx, 'release', v[0] / 100)} />
                                </div>
                             </div>
                          </div>
                          <div className="space-y-8 bg-black/40 p-8 rounded-[2rem] border border-white/5">
                             <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">EFFECTS</h4>
                             <div className="space-y-6">
                                <div className="space-y-2">
                                   <label className="text-[9px] font-black text-muted-foreground uppercase">Drive</label>
                                   <Slider value={[s.distortion * 100]} onValueChange={(v) => updateChannelSetting(chIdx, 'distortion', v[0] / 100)} />
                                </div>
                                <div className="space-y-2">
                                   <label className="text-[9px] font-black text-muted-foreground uppercase">Cutoff</label>
                                   <Slider value={[s.cutoff * 100]} onValueChange={(v) => updateChannelSetting(chIdx, 'cutoff', v[0] / 100)} />
                                </div>
                             </div>
                          </div>
                       </div>
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
                        const cid = selectedClipsForChannel[chIdx.toString()];
                        if (!cid) return;
                        const key = `${chIdx}-${stepIdx}`;
                        const ng = { ...grid };
                        if (ng[key]?.includes(cid)) {
                          ng[key] = ng[key].filter(id => id !== cid);
                          if (ng[key].length === 0) delete ng[key];
                        } else {
                          ng[key] = [cid];
                          playClip(cid, chIdx.toString());
                        }
                        setGrid(ng);
                      }}
                      className={cn(
                        "w-16 h-full rounded-2xl transition-all duration-300 flex items-center justify-center relative shrink-0",
                        clip ? `${s.color} shadow-2xl brightness-125 translate-y-[-4px]` : "bg-neutral-800/40 hover:bg-neutral-700/60 border border-white/5",
                        isCurrent ? "ring-4 ring-primary/40 scale-110 z-10" : "scale-100",
                        clip && isCurrent ? "step-glow-active" : ""
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
