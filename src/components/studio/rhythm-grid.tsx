
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
  Upload, DownloadCloud,
  Edit2Icon
} from 'lucide-react';
import { db, User, AudioClip, Track, ChannelSettings } from '@/lib/db';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { makeDistortionCurve, audioBufferToWav } from '@/lib/audio-utils';
import { MasterVisualizer } from './visualizers';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { ChannelSettingsDialog } from './channel-settings-dialog';
import StudioHeader from './Header';

const DEFAULT_CHANNELS = 4;

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
  const [currentStep, setCurrentStep] = useState(-1);
  const [numSteps, setNumSteps] = useState(track?.numSteps || 16);
  const [bpm, setBpm] = useState(track?.bpm || 120);

  const [numChannels, setNumChannels] = useState(track?.numChannels || DEFAULT_CHANNELS);
  const [grid, setGrid] = useState<Record<string, string[]>>(track?.grid || {});

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
    const s = channelSettings[channelIdx] || DEFAULT_CHANNEL_SETTINGS;
    if (s.muted && !scheduledTime) return;

    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    try {
      const ctx = context || initAudioContext();
      if (ctx instanceof AudioContext && ctx.state === 'suspended') await ctx.resume();

      let buffer = await loadAudio(clip, ctx);
      if (!buffer) return;

      if (s.reversed) {
        if (!reversedBuffersRef.current[clipId]) {
          const rev = new AudioBuffer({ length: buffer.length, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
          for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            const originalData = buffer.getChannelData(ch);
            const reversedData = rev.getChannelData(ch);
            for (let i = 0; i < buffer.length; i++) {
              reversedData[i] = originalData[buffer.length - 1 - i];
            }
          }
          reversedBuffersRef.current[clipId] = rev;
        }
        buffer = reversedBuffersRef.current[clipId];
      }

      const unison = s.unison || 0;
      const pitch = s.pitch || 1.0;
      const coarseMult = Math.pow(2, (s.oscCoarse || 0) / 12);
      const fineMult = Math.pow(2, (s.oscFine || 0) / 1200);
      const basePlaybackRate = Math.max(0.001, pitch * coarseMult * fineMult);

      const numVoices = (s.fxActive && unison > 0) ? 3 : 1;
      const startTime = scheduledTime !== undefined ? scheduledTime : ctx.currentTime;
      const trimStart = isNaN(s.trimStart) ? 0 : s.trimStart;
      const trimEnd = isNaN(s.trimEnd) ? 1 : s.trimEnd;
      const duration = (buffer.duration * (trimEnd - trimStart)) / basePlaybackRate;

      for (let v = 0; v < numVoices; v++) {
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        const panNode = ctx.createStereoPanner();
        const filterNode = ctx.createBiquadFilter();
        const distortionNode = ctx.createWaveShaper();
        const limiterNode = ctx.createDynamicsCompressor();

        limiterNode.threshold.setValueAtTime(-1, startTime);
        limiterNode.knee.setValueAtTime(0, startTime);
        limiterNode.ratio.setValueAtTime(20, startTime);
        limiterNode.attack.setValueAtTime(0.001, startTime);
        limiterNode.release.setValueAtTime(0.1, startTime);

        const detuneAmount = (v === 0) ? 0 : (v === 1 ? unison * 0.1 : -unison * 0.1);
        source.buffer = buffer;
        source.playbackRate.setValueAtTime(Math.max(0.001, basePlaybackRate + detuneAmount), startTime);

        const panValue = Math.max(-1, Math.min(1, (s.pan ?? 0) + (v === 1 ? 0.2 : v === 2 ? -0.2 : 0)));
        panNode.pan.setValueAtTime(panValue, startTime);

        if (s.svfActive) {
          filterNode.type = s.svfType || 'lowpass';
          const baseFreq = Math.max(20, 20 + (Math.pow(s.svfCut ?? 1, 2) * 19980));
          const peakFreq = Math.min(20000, baseFreq * (1 + ((s.svfEnv ?? 0) * 10)));
          filterNode.frequency.setValueAtTime(baseFreq, startTime);
          filterNode.frequency.exponentialRampToValueAtTime(peakFreq, startTime + Math.max(0.001, s.svfAttack ?? 0.01));
          filterNode.frequency.exponentialRampToValueAtTime(Math.max(20, peakFreq * (s.svfSustain ?? 0.5)), startTime + Math.max(0.001, (s.svfAttack ?? 0.01) + (s.svfDecay ?? 0.1)));
          filterNode.Q.setValueAtTime((s.svfEmph ?? 0.2) * 20, startTime);
        } else {
          filterNode.type = 'allpass';
        }

        const peakGain = s.ampActive ? ((s.volume ?? 0.8) * (s.limiterPre ?? 1.0) * (s.ampLevel ?? 1.0)) : (s.volume ?? 0.8);
        const safePeakGain = isNaN(peakGain) ? 0.8 : Math.max(0.0001, peakGain);

        if (s.ampActive) {
          gainNode.gain.setValueAtTime(0, startTime);
          gainNode.gain.linearRampToValueAtTime(safePeakGain, startTime + Math.max(0.001, s.ampAttack ?? 0.01));
          gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, safePeakGain * (s.ampSustain ?? 1.0)), startTime + Math.max(0.001, (s.ampAttack ?? 0.01) + (s.ampDecay ?? 0.1)));
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
        } else {
          gainNode.gain.setValueAtTime(safePeakGain, startTime);
        }

        source.connect(filterNode);
        filterNode.connect(distortionNode);
        if (s.fxActive && (s.distortion ?? 0) > 0) {
          distortionNode.curve = makeDistortionCurve(s.distortion);
        } else {
          distortionNode.curve = null;
        }
        distortionNode.connect(gainNode);
        gainNode.connect(panNode);

        const destination = context ? context.destination : (masterAnalyserRef.current || ctx.destination);
        if (s.fxActive && (s.limiterMix ?? 0) > 0) {
          panNode.connect(limiterNode);
          limiterNode.connect(destination);
        } else {
          panNode.connect(destination);
        }

        source.start(startTime, (trimStart ?? 0) * buffer.duration, duration);
      }
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

  const batchUpdateChannelSetting = (idx: string, settings: Partial<ChannelSettings>) => {
    setChannelSettings(p => ({ ...p, [idx]: { ...p[idx], ...settings } }));
  };



  return (
    <div className="space-y-12">
      <div className="glass-panel p-10 rounded-[3rem] gold-shadow relative overflow-hidden">
        <div className="absolute inset-0 studio-grid-bg opacity-10" />
        <StudioHeader grid={grid} audioBufferToWav={audioBufferToWav} playClip={playClip} onImportRefresh={onImportRefresh} clips={clips} onSaveTrack={onSaveTrack} channelSettings={channelSettings} numChannels={numChannels} user={user} selectedClipsForChannel={selectedClipsForChannel} masterAnalyserRef={masterAnalyserRef} setGrid={setGrid} track={track} setNumSteps={setNumSteps} setBpm={setBpm} setIsPlaying={setIsPlaying} isPlaying={isPlaying} bpm={bpm} numSteps={numSteps} />
      </div>

      {/* Studio Grid   */}
      <div className="glass-panel flex flex-col w-full rounded-[3rem] p-12 gold-shadow bg-black/40">
        <div className='w-full flex flex-col lg:flex-row' >
          <div className='lg:w-[35%] border-r border-white/5 flex flex-col p-4 ' >
            {Array.from({ length: numChannels }).map((_, chIdx) => {
              const chKey = chIdx.toString();
              const s = channelSettings[chKey] || DEFAULT_CHANNEL_SETTINGS;
              const selId = selectedClipsForChannel[chKey] || '';
              return (
                <div key={chIdx} className="bg-neutral-900/40 p-5 rounded-[2.5rem] flex items-center gap-6 border border-white/5">
                  <button
                    onClick={() => { if (selId) playClip(selId, chKey); }}
                    className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all shrink-0", s.muted ? "bg-neutral-800" : s.color)}
                  >
                    <Music className={cn("w-8 h-8", s.muted ? "text-muted-foreground" : "text-black")} />
                  </button>
                  <div className="flex-1 space-y-4 min-w-0">
                    <select
                      className="w-full bg-transparent text-[11px] font-black uppercase text-primary outline-none cursor-pointer truncate"
                      value={selId}
                      onChange={(e) => setSelectedClipsForChannel(p => ({ ...p, [chKey]: e.target.value }))}
                    >
                      <option value="" className="bg-black">SELECT_CLIP</option>
                      {clips.map(c => <option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
                    </select>
                    <div className="flex items-center gap-4">
                      <Volume1 className="w-3.5 h-3.5 text-muted-foreground" />
                      <Slider value={[(s.volume ?? 0.8) * 100]} onValueChange={(v) => updateChannelSetting(chKey, 'volume', v[0] / 100)} className="h-1.5 flex-1" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button variant="ghost" size="icon" className={cn("h-10 w-10 rounded-xl", s.muted ? "text-red-500 bg-red-500/10" : "text-muted-foreground")} onClick={() => updateChannelSetting(chKey, 'muted', !s.muted)}>
                      {s.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </Button>
                    <ChannelSettingsDialog
                      channelIdx={chIdx}
                      settings={s}
                      onUpdate={(key, val) => updateChannelSetting(chKey, key, val)}
                      onBatchUpdate={(settings) => batchUpdateChannelSetting(chKey, settings)}
                      onAudition={() => { if (selId) playClip(selId, chKey); }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex-1 pl-6 overflow-x-auto flex flex-col justify-between  py-4">
            {Array.from({ length: numChannels }).map((_, chIdx) => (
              <div key={chIdx} className='flex items-center  justify-start gap-2 h-[130px]'>
                {Array.from({ length: numSteps }).map((_, stepIdx) => {
                  const clipIds = grid[`${chIdx}-${stepIdx}`] || [];
                  const clip = clips.find(c => c.id === clipIds[0]);
                  const char = CHARACTER_TYPES.find(ct => ct.id === clip?.characterType);
                  const CharIcon = char?.icon;
                  const isCurrent = stepIdx === currentStep;
                  const isGroupStart = stepIdx % 4 === 0;
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
                        "w-12 h-20 rounded-xl transition-all duration-300 flex items-center justify-center relative shrink-0",
                        clip ? `${channelSettings[chIdx.toString()]?.color} shadow-2xl brightness-125` : "bg-neutral-800/40 border border-white/5 hover:bg-neutral-800",
                        isCurrent ? "ring-2 ring-primary scale-110 z-10" : "scale-100",
                        isGroupStart ? "ml-4 first:ml-0" : ""
                      )}
                    >
                      {CharIcon && <CharIcon className={cn("w-6 h-6 text-black")} />}
                      {stepIdx % 4 === 0 && !clip && <div className="absolute -bottom-1 w-full h-0.5 bg-primary/20 rounded-full" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full border-dashed border-2 py-10 mt-8 rounded-[2.5rem] gap-4 bg-black/20 border-primary/20 hover:bg-primary/5 group"
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


