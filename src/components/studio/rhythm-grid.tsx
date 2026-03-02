
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Play, Square, Music, Save, Download, Plus, Trash2,
  Loader2, Zap, Waves, Sparkles, Mic2, VolumeX, Volume2,
  RotateCcw, Scissors, Timer, Settings, Volume1, Maximize2,
  Gauge, Activity, Sliders, Repeat,
  ChevronRight, ArrowRightLeft, FastForward, Clock, FileUp, FileDown,
  Dices, ArrowLeft, ArrowRight, Copy, X, AlertTriangle, Wand2,
  Upload, DownloadCloud
} from 'lucide-react';
import { db, User, AudioClip, Track, ChannelSettings } from '@/lib/db';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { makeDistortionCurve, audioBufferToWav } from '@/lib/audio-utils';
import { MasterVisualizer } from './visualizers';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { ChannelSettingsDialog } from './channel-settings-dialog';

const DEFAULT_CHANNELS = 6;
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
  
  // Bypass Flags
  oscActive: true,
  svfActive: true,
  lfoActive: true,
  fxActive: true,
  ampActive: true,

  // Synthesis Parameters
  unison: 0,
  vibrato: 0,

  // OSC Lab
  oscCoarse: 0,
  oscFine: 0,
  oscLevel: 1.0,
  oscLfo: 0,
  oscEnv: 0,
  oscPw: 0,

  // AMP Envelope (Amplifier)
  ampAttack: 0.01,
  ampHold: 0,
  ampDecay: 0.1,
  ampSustain: 1.0,
  ampRelease: 0.1,
  ampLevel: 1.0,

  // SVF (State Variable Filter)
  svfCut: 1.0,
  svfEmph: 0.2,
  svfEnv: 0,
  svfLfo: 0,
  svfKb: 0,
  svfType: 'lowpass',
  svfAttack: 0.01,
  svfDecay: 0.1,
  svfSustain: 0.5,
  svfRelease: 0.1,

  // LFO Lab
  lfoRate: 1.0,
  lfoDelay: 0,

  // Limiter
  limiterPre: 1.0,
  limiterMix: 0,

  // Legacy/Internal Mapping
  attack: 0.01,
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
  const [bpm, setBpm] = useState(track?.bpm || 130);
  const [numSteps, setNumSteps] = useState(track?.numSteps || 16);
  const [numChannels, setNumChannels] = useState(track?.numChannels || DEFAULT_CHANNELS);
  const [grid, setGrid] = useState<Record<string, string[]>>(track?.grid || {});
  const [title, setTitle] = useState(track?.title || 'NEW_PROJECT');

  const [channelSettings, setChannelSettings] = useState<Record<string, ChannelSettings>>(() => {
    const baseSettings: Record<string, ChannelSettings> = {};
    const count = Math.max(DEFAULT_CHANNELS, track?.numChannels || 0);
    
    for (let i = 0; i < count; i++) {
      const key = i.toString();
      const existing = track?.channelSettings?.[key];
      baseSettings[key] = { 
        ...DEFAULT_CHANNEL_SETTINGS, 
        ...existing,
        color: existing?.color || CHANNEL_COLORS[i % CHANNEL_COLORS.length].class 
      };
    }
    return baseSettings;
  });

  const [selectedClipsForChannel, setSelectedClipsForChannel] = useState<Record<string, string>>(
    track?.selectedClips ||
    Object.fromEntries(Array.from({ length: DEFAULT_CHANNELS }).map((_, i) => [i.toString(), '']))
  );

  const schedulerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});

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
      compressor.connect(analyser);
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
      return null;
    }
  }, [initAudioContext]);

  const playClip = useCallback(async (clipId: string, channelIdx: string, scheduledTime?: number, context?: BaseAudioContext) => {
    const s = channelSettings[channelIdx] || DEFAULT_CHANNEL_SETTINGS;
    if (s.muted && !scheduledTime) return;

    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    try {
      const ctx = context || initAudioContext();
      let buffer = await loadAudio(clip, ctx);
      if (!buffer) return;

      const pitch = s.pitch || 1.0;
      const coarseMult = Math.pow(2, (s.oscCoarse || 0) / 12);
      const fineMult = Math.pow(2, (s.oscFine || 0) / 1200);
      const basePlaybackRate = Math.max(0.001, pitch * coarseMult * fineMult);
      
      const startTime = scheduledTime !== undefined ? scheduledTime : ctx.currentTime;
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const panNode = ctx.createStereoPanner();
      const filterNode = ctx.createBiquadFilter();

      source.buffer = buffer;
      source.playbackRate.setValueAtTime(basePlaybackRate, startTime);
      panNode.pan.setValueAtTime(s.pan ?? 0, startTime);

      if (s.svfActive) {
        filterNode.type = s.svfType || 'lowpass';
        const baseFreq = Math.max(20, 20 + (Math.pow(s.svfCut ?? 1, 2) * 19980));
        filterNode.frequency.setValueAtTime(baseFreq, startTime);
        filterNode.Q.setValueAtTime((s.svfEmph ?? 0.2) * 20, startTime);
      } else {
        filterNode.type = 'allpass';
      }

      const peakGain = Math.max(0.0001, (s.volume ?? 0.8));
      gainNode.gain.setValueAtTime(peakGain, startTime);

      source.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(context ? context.destination : (masterAnalyserRef.current || ctx.destination));

      source.start(startTime);
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
    toast({ title: "DAW Session Saved" });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* TOP BAR / TRANSPORT */}
      <div className="bg-[#0d0d0d] border border-white/5 rounded-[2.5rem] p-8 flex items-center justify-between gap-10 shadow-2xl">
         <div className="flex items-center gap-6">
            <Button
              variant={isPlaying ? "destructive" : "default"}
              className={cn("w-16 h-16 rounded-2xl shadow-xl transition-all", isPlaying ? "bg-red-500" : "bg-primary text-black")}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Square className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
            </Button>
            
            <div className="flex flex-col gap-2">
               <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">BPM</span>
               <div className="flex items-center gap-3 bg-black px-4 py-2 rounded-xl border border-white/5">
                  <input 
                    type="number" 
                    value={bpm} 
                    onChange={(e) => setBpm(parseInt(e.target.value))}
                    className="bg-transparent text-xl font-black text-primary outline-none w-16 text-center"
                  />
               </div>
            </div>

            <div className="flex flex-col gap-2">
               <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Steps</span>
               <div className="flex items-center gap-3 bg-black px-4 py-2 rounded-xl border border-white/5">
                  <input 
                    type="number" 
                    value={numSteps} 
                    onChange={(e) => setNumSteps(parseInt(e.target.value))}
                    className="bg-transparent text-xl font-black text-primary outline-none w-12 text-center"
                  />
               </div>
            </div>
         </div>

         <div className="flex-1 max-w-md h-16 bg-black rounded-2xl border border-white/5 p-4 flex items-center">
            <MasterVisualizer analyser={masterAnalyserRef.current} />
         </div>

         <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="w-12 h-12 rounded-xl text-primary/40 hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20" onClick={handleSave}>
               <Save className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-12 h-12 rounded-xl text-primary/40 hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20" onClick={() => setGrid({})}>
               <Trash2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="w-12 h-12 rounded-xl text-primary/40 hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20">
               <DownloadCloud className="w-5 h-5" />
            </Button>
         </div>
      </div>

      {/* CHANNEL RACK */}
      <div className="bg-[#0d0d0d] border border-white/5 rounded-[3rem] p-10 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 studio-grid-bg opacity-[0.02]" />
        
        <div className="space-y-4 relative z-10">
          {Array.from({ length: numChannels }).map((_, chIdx) => {
            const chKey = chIdx.toString();
            const s = channelSettings[chKey] || DEFAULT_CHANNEL_SETTINGS;
            const selId = selectedClipsForChannel[chKey] || '';
            const activeClip = clips.find(c => c.id === selId);

            return (
              <div key={chIdx} className="flex items-center gap-4">
                {/* MIXER SECTION */}
                <div className="w-[450px] bg-black/40 p-4 rounded-2xl border border-white/5 flex items-center gap-5">
                   <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <Button 
                        variant="ghost" size="icon" 
                        className={cn("w-6 h-6 rounded-full", s.muted ? "bg-red-500" : "bg-neutral-800")}
                        onClick={() => updateChannelSetting(chKey, 'muted', !s.muted)}
                      />
                   </div>

                   <div className="flex flex-col gap-1 flex-1 min-w-0">
                      <select
                        className="bg-transparent text-[10px] font-black uppercase text-primary outline-none truncate"
                        value={selId}
                        onChange={(e) => setSelectedClipsForChannel(p => ({ ...p, [chKey]: e.target.value }))}
                      >
                        <option value="" className="bg-black">Empty_Slot</option>
                        {clips.map(c => <option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
                      </select>
                      <div className="flex items-center gap-3">
                         <div className="flex flex-col items-center flex-1">
                            <Slider value={[(s.volume ?? 0.8) * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'volume', v[0] / 100)} className="h-1" />
                            <span className="text-[7px] font-black text-muted-foreground uppercase mt-1 tracking-tighter">VOL</span>
                         </div>
                         <div className="flex flex-col items-center flex-1">
                            <Slider value={[(s.pan ?? 0) * 50 + 50]} onValueChange={(v) => updateChannelSetting(chKey, 'pan', (v[0] - 50) / 50)} className="h-1" />
                            <span className="text-[7px] font-black text-muted-foreground uppercase mt-1 tracking-tighter">PAN</span>
                         </div>
                      </div>
                   </div>

                   <ChannelSettingsDialog 
                     channelIdx={chIdx} 
                     settings={s} 
                     onUpdate={(key, val) => updateChannelSetting(chKey, key, val)}
                     onBatchUpdate={(settings) => setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], ...settings } }))}
                     onAudition={() => { if (selId) playClip(selId, chKey); }}
                   />
                </div>

                {/* STEP SEQUENCER */}
                <div className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
                  {Array.from({ length: numSteps }).map((_, stepIdx) => {
                    const clipIds = grid[`${chIdx}-${stepIdx}`] || [];
                    const isGroupStart = stepIdx % 4 === 0;
                    const isActive = clipIds.includes(selId);
                    const isCurrent = stepIdx === currentStep;

                    return (
                      <button
                        key={stepIdx}
                        onClick={() => {
                          if (!selId) return;
                          const key = `${chIdx}-${stepIdx}`;
                          const ng = { ...grid };
                          if (isActive) {
                            ng[key] = ng[key].filter(id => id !== selId);
                            if (ng[key].length === 0) delete ng[key];
                          } else {
                            ng[key] = [selId];
                            playClip(selId, chKey);
                          }
                          setGrid(ng);
                        }}
                        className={cn(
                          "w-10 h-10 rounded-lg transition-all border",
                          isActive 
                            ? (isGroupStart ? "bg-primary border-primary shadow-[0_0_10px_rgba(250,204,21,0.3)]" : "bg-primary/80 border-primary/40")
                            : (isGroupStart ? "bg-[#1a1a1a] border-white/10" : "bg-[#141414] border-white/5"),
                          isCurrent && "ring-2 ring-white scale-110 z-10",
                          !isActive && "hover:bg-white/5"
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <Button
          variant="outline"
          className="w-full h-16 mt-10 rounded-2xl border-dashed border-2 border-white/5 bg-black/40 text-[11px] font-black uppercase tracking-[0.4em] text-muted-foreground hover:text-white hover:bg-white/5"
          onClick={() => setNumChannels(p => p + 1)}
        >
          <Plus className="w-4 h-4 mr-3" /> New_Channel_Slot
        </Button>
      </div>

      {/* FOOTER METRICS */}
      <footer className="flex items-center justify-between px-10 py-4 bg-black/40 rounded-full border border-white/5 text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">
         <div className="flex items-center gap-6">
            <span className="flex items-center gap-2"><Activity className="w-3 h-3 text-primary" /> Engine_Clock: 44.1khz</span>
            <span className="flex items-center gap-2"><Maximize2 className="w-3 h-3 text-primary" /> Signal_Dynamic: 32bit_Float</span>
         </div>
         <div className="flex items-center gap-6">
            <span>Project_Rev: v1.0.4</span>
            <span className="text-primary">Latency_Comp: 12ms</span>
         </div>
      </footer>
    </div>
  );
}

function MasterVisualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      const barWidth = (canvasRef.current!.width / dataArray.length) * 2;
      let x = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvasRef.current!.height;
        ctx.fillStyle = `rgba(250, 204, 21, ${0.1 + (dataArray[i] / 255) * 0.9})`;
        ctx.fillRect(x, canvasRef.current!.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    draw();
  }, [analyser]);

  return <canvas ref={canvasRef} width={400} height={40} className="w-full h-full opacity-60" />;
}
