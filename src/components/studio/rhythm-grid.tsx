"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Play, Square, Save, Trash2, Plus, 
  Settings, Volume2, Activity, Maximize2,
  ChevronDown, MoreHorizontal, Power, 
  BarChart3, Music2, Wand2
} from 'lucide-react';
import { db, User, AudioClip, Track, ChannelSettings, NoteProperty } from '@/lib/db';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { MasterVisualizer } from './visualizers';
import { ChannelSettingsDialog } from './channel-settings-dialog';

const DEFAULT_CHANNELS = 8;
const MAX_STEPS = 64;

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
    const s = channelSettings[chIdx] || DEFAULT_CHANNEL_SETTINGS;
    if (s.muted) return;

    const clip = clips.find(c => c.id === note.clipId);
    if (!clip) return;

    const buffer = await loadBuffer(clip, ctx);
    if (!buffer) return;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const panNode = ctx.createStereoPanner();
    const filterNode = ctx.createBiquadFilter();

    // Value sanitization to prevent non-finite errors
    const basePitch = Math.max(0.1, (s.pitch || 1.0) * Math.pow(2, (note.finePitch || 0) / 1200));
    const finalPan = Math.max(-1, Math.min(1, s.pan || 0));
    const finalVol = Math.max(0, (note.velocity ?? 1.0) * (s.volume ?? 0.8));

    source.buffer = buffer;
    source.playbackRate.setValueAtTime(basePitch, time);
    panNode.pan.setValueAtTime(finalPan, time);
    gainNode.gain.setValueAtTime(finalVol, time);

    if (s.svfActive) {
      filterNode.type = s.svfType || 'lowpass';
      const freq = Math.max(20, Math.min(20000, 20 + (Math.pow(s.svfCut || 1, 2) * 19980)));
      filterNode.frequency.setValueAtTime(freq, time);
      filterNode.Q.setValueAtTime(Math.max(0.0001, (s.svfEmph || 0.2) * 20), time);
    } else {
      filterNode.type = 'allpass';
    }

    source.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(masterAnalyserRef.current || ctx.destination);

    source.start(time);
  }, [clips, channelSettings, initAudio]);

  const schedule = useCallback(() => {
    const ctx = initAudio();
    const secondsPerStep = (60.0 / Math.max(20, bpm)) / 4;

    while (nextNoteTimeRef.current < ctx.currentTime + 0.1) {
      const step = currentStepRef.current;
      for (let ch = 0; ch < numChannels; ch++) {
        const notes = grid[`${ch}-${step}`];
        if (notes) {
          notes.forEach(n => playNote(n, ch.toString(), nextNoteTimeRef.current));
        }
      }
      nextNoteTimeRef.current += secondsPerStep;
      currentStepRef.current = (currentStepRef.current + 1) % numSteps;
      setTimeout(() => setCurrentStep(step), Math.max(0, (nextNoteTimeRef.current - ctx.currentTime) * 1000));
    }
  }, [bpm, grid, numChannels, numSteps, playNote, initAudio]);

  useEffect(() => {
    if (isPlaying) {
      const ctx = initAudio();
      nextNoteTimeRef.current = ctx.currentTime;
      currentStepRef.current = 0;
      schedulerTimerRef.current = setInterval(schedule, 25);
    } else {
      if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current);
      setCurrentStep(-1);
    }
    return () => { if (schedulerTimerRef.current) clearInterval(schedulerTimerRef.current); };
  }, [isPlaying, schedule, initAudio]);

  const toggleStep = (chIdx: number, stepIdx: number) => {
    const clipId = selectedClips[chIdx.toString()];
    if (!clipId) return;

    const key = `${chIdx}-${stepIdx}`;
    const current = grid[key] || [];
    const exists = current.find(n => n.clipId === clipId);

    const newGrid = { ...grid };
    if (exists) {
      newGrid[key] = current.filter(n => n.clipId !== clipId);
      if (newGrid[key].length === 0) delete newGrid[key];
    } else {
      newGrid[key] = [...current, { id: crypto.randomUUID(), clipId, velocity: 0.8, finePitch: 0 }];
      playNote(newGrid[key][newGrid[key].length - 1], chIdx.toString(), (audioContextRef.current?.currentTime || 0) + 0.05);
    }
    setGrid(newGrid);
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
    toast({ title: "Pattern Saved" });
  };

  const handleRandomize = () => {
    const newGrid: Record<string, NoteProperty[]> = {};
    for (let ch = 0; ch < numChannels; ch++) {
      const clipId = selectedClips[ch.toString()];
      if (!clipId) continue;
      for (let s = 0; s < numSteps; s++) {
        if (Math.random() > 0.8) {
          newGrid[`${ch}-${s}`] = [{ id: crypto.randomUUID(), clipId, velocity: 0.6 + Math.random() * 0.4, finePitch: 0 }];
        }
      }
    }
    setGrid(newGrid);
    toast({ title: "Pattern Randomly Generated" });
  };

  return (
    <div className="flex flex-col gap-1 h-full select-none">
      {/* DAW TOOLBAR */}
      <div className="flex items-center justify-between bg-[#111] border-b border-white/5 p-1 h-12 shadow-md z-50">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-muted-foreground uppercase hover:bg-white/5">File</Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-muted-foreground uppercase hover:bg-white/5">Edit</Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-muted-foreground uppercase hover:bg-white/5">Add</Button>
          <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] font-bold text-muted-foreground uppercase hover:bg-white/5">Patterns</Button>
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

        <div className="flex items-center gap-8 bg-black/40 px-6 py-1 rounded-sm border border-white/5">
           <div className="flex flex-col items-center min-w-[100px]">
              <span className="text-[8px] text-primary/60 font-black uppercase leading-none mb-1">BPM: {bpm.toFixed(1)}</span>
              <Slider value={[bpm]} min={60} max={200} step={0.1} onValueChange={(v) => setBpm(v[0])} className="w-24" />
           </div>
           <div className="w-px h-8 bg-white/10" />
           <div className="flex flex-col items-center min-w-[100px]">
              <span className="text-[8px] text-primary/60 font-black uppercase leading-none mb-1">STEPS: {numSteps}</span>
              <Slider value={[numSteps]} min={8} max={64} step={8} onValueChange={(v) => setNumSteps(v[0])} className="w-24" />
           </div>
           <div className="w-px h-8 bg-white/10" />
           <div className="w-40 h-8">
              <MasterVisualizer analyser={masterAnalyserRef.current} />
           </div>
        </div>

        <div className="flex items-center gap-2">
           <Button variant="ghost" size="sm" className="h-8 px-4 text-[10px] font-black uppercase text-primary border border-primary/20 hover:bg-primary/5" onClick={handleSave}>
              <Save className="w-3 h-3 mr-2" /> Commit Pattern
           </Button>
        </div>
      </div>

      {/* CHANNEL RACK WINDOW */}
      <div className="flex-1 flex flex-col bg-[#1e2329] rounded-sm daw-button-outer overflow-hidden m-4 border border-white/10">
        <div className="h-8 bg-[#2d333b] border-b border-black flex items-center justify-between px-3">
          <div className="flex items-center gap-2">
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
            <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_5px_rgba(255,153,0,0.5)]" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Channel Rack</span>
          </div>
          <div className="flex items-center gap-2">
             <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-white"><BarChart3 className="w-3 h-3" /></Button>
             <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-white"><MoreHorizontal className="w-3 h-3" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
          {Array.from({ length: numChannels }).map((_, chIdx) => {
            const chKey = chIdx.toString();
            const s = channelSettings[chKey] || DEFAULT_CHANNEL_SETTINGS;
            const activeClipId = selectedClips[chKey];
            const activeClip = clips.find(c => c.id === activeClipId);
            
            return (
              <div key={chIdx} className={cn("flex items-center gap-2 h-9 p-1 group hover:bg-white/5", selectedChannelForGraph === chIdx && "bg-primary/5")}>
                {/* MUTE / PAN / VOL */}
                <button 
                  onClick={() => setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], muted: !s.muted }}))}
                  className={cn("w-3 h-3 rounded-full border border-black daw-button-inner transition-colors", s.muted ? "bg-red-900/40" : "bg-primary shadow-[0_0_6px_rgba(255,153,0,0.6)]")} 
                />
                
                <div className="flex items-center gap-1 shrink-0">
                  <div className="w-6 h-6 rounded-full bg-[#111] daw-button-inner flex items-center justify-center relative cursor-ns-resize group/knob"
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

                {/* CHANNEL NAME */}
                <button 
                  onClick={() => setSelectedChannelForGraph(chIdx)}
                  className={cn(
                    "w-32 h-7 rounded-sm text-[10px] font-bold uppercase tracking-tight truncate px-2 text-left daw-button-outer transition-colors",
                    selectedChannelForGraph === chIdx ? "bg-muted text-primary" : "bg-[#2d333b] text-muted-foreground hover:text-white"
                  )}
                >
                  {activeClip?.name || `CHANNEL_${chIdx + 1}`}
                </button>

                {/* STEP GRID */}
                <div className="flex-1 flex gap-1 h-full items-center">
                  {Array.from({ length: numSteps }).map((_, stepIdx) => {
                    const groupIdx = Math.floor(stepIdx / 4);
                    const isGroupLight = groupIdx % 2 === 0;
                    const notes = grid[`${chIdx}-${stepIdx}`] || [];
                    const isActive = notes.length > 0;
                    const isCurrent = stepIdx === currentStep;

                    return (
                      <button
                        key={stepIdx}
                        onClick={() => toggleStep(chIdx, stepIdx)}
                        className={cn(
                          "flex-1 h-6 rounded-[1px] transition-all transform active:scale-95 daw-button-outer",
                          isActive ? "step-active" : (isGroupLight ? "step-inactive-light" : "step-inactive-dark"),
                          isCurrent && "ring-1 ring-white brightness-125 scale-105 z-10"
                        )}
                      />
                    );
                  })}
                </div>

                <ChannelSettingsDialog 
                  channelIdx={chIdx} 
                  settings={s} 
                  onUpdate={(k, v) => setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], [k]: v }}))}
                  onBatchUpdate={(ns) => setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], ...ns }}))}
                  onAudition={() => activeClip && playNote({ id: 'audition', clipId: activeClip.id, velocity: 1, finePitch: 0 }, chKey, (audioContextRef.current?.currentTime || 0))}
                />
              </div>
            );
          })}

          <Button 
            variant="ghost" 
            className="w-full h-8 text-[9px] font-black uppercase text-muted-foreground hover:text-white hover:bg-white/5 mt-4 border border-dashed border-white/5"
            onClick={() => setNumChannels(p => Math.min(16, p + 1))}
          >
            <Plus className="w-3 h-3 mr-2" /> Add Mixer Channel
          </Button>
        </div>

        {/* GRAPH EDITOR PANEL */}
        <div className="h-48 bg-[#1a1f25] border-t border-black p-2 flex flex-col gap-2">
           <div className="flex items-center justify-between px-2">
              <div className="flex gap-4">
                 <button className="text-[9px] font-black text-primary uppercase tracking-widest border-b border-primary">Velocity</button>
                 <button className="text-[9px] font-black text-muted-foreground uppercase tracking-widest hover:text-white">Panning</button>
              </div>
              <span className="text-[8px] font-bold text-muted-foreground uppercase">Modifying: Ch {selectedChannelForGraph + 1}</span>
           </div>
           
           <div className="flex-1 flex gap-1 items-end pt-4 px-2">
              {Array.from({ length: numSteps }).map((_, stepIdx) => {
                const notes = grid[`${selectedChannelForGraph}-${stepIdx}`] || [];
                const velocity = notes[0]?.velocity || 0;
                
                return (
                  <div key={stepIdx} className="flex-1 h-full flex flex-col justify-end group/bar">
                     <div 
                        className={cn("w-full rounded-t-sm transition-all daw-button-outer cursor-ns-resize", velocity > 0 ? "bg-primary/60 group-hover/bar:bg-primary" : "bg-white/5")}
                        style={{ height: `${velocity * 100}%` }}
                        onMouseDown={(e) => {
                          const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                          if (!rect) return;
                          const handleMove = (me: MouseEvent) => {
                            const val = Math.max(0.05, Math.min(1.0, 1 - (me.clientY - rect.top) / rect.height));
                            const key = `${selectedChannelForGraph}-${stepIdx}`;
                            if (grid[key]) {
                              const ng = { ...grid };
                              ng[key] = ng[key].map(n => ({ ...n, velocity: val }));
                              setGrid(ng);
                            }
                          };
                          const handleUp = () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
                          window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
                        }}
                     />
                  </div>
                );
              })}
           </div>
        </div>
      </div>
    </div>
  );
}
