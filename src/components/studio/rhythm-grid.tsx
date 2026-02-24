"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Music, Save, Volume2, Waves, Clock, MoveHorizontal, Filter, Plus, Trash2, Palette, Settings2, Sparkles } from 'lucide-react';
import { db, User, AudioClip, Track, ChannelSettings } from '@/lib/db';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';

const DEFAULT_CHANNELS = 4;
const MAX_STEPS = 64;

const CHANNEL_COLORS = [
  { name: 'Purple', class: 'bg-primary', hex: '#8b5cf6' },
  { name: 'Red', class: 'bg-red-500', hex: '#ef4444' },
  { name: 'Blue', class: 'bg-blue-500', hex: '#3b82f6' },
  { name: 'Green', class: 'bg-green-500', hex: '#22c55e' },
  { name: 'Pink', class: 'bg-pink-500', hex: '#ec4899' },
  { name: 'Orange', class: 'bg-orange-500', hex: '#f97316' },
];

const DEFAULT_CHANNEL_SETTINGS: ChannelSettings = {
  volume: 0.8,
  pitch: 1.0,
  delay: 0,
  reverb: 0,
  pan: 0,
  cutoff: 1.0,
  color: 'bg-primary',
};

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
  const [channelSettings, setChannelSettings] = useState<Record<string, ChannelSettings>>(
    track?.channelSettings ||
    Object.fromEntries(Array.from({ length: DEFAULT_CHANNELS }).map((_, i) => [i.toString(), { ...DEFAULT_CHANNEL_SETTINGS, color: CHANNEL_COLORS[i % CHANNEL_COLORS.length].class }]))
  );
  const [selectedClipsForChannel, setSelectedClipsForChannel] = useState<Record<string, string>>(
    track?.selectedClips ||
    Object.fromEntries(Array.from({ length: DEFAULT_CHANNELS }).map((_, i) => [i.toString(), '']))
  );
  const [title, setTitle] = useState(track?.title || 'My First Drop');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    } catch (error) {
      console.error("Error loading audio:", error);
      throw error;
    }
  }, [initAudioContext]);

  const playClip = useCallback(async (clipId: string, channelIdxString: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const settings = channelSettings[channelIdxString] || DEFAULT_CHANNEL_SETTINGS;

    try {
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const buffer = await loadAudio(clip);
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const panNode = ctx.createStereoPanner();
      const filterNode = ctx.createBiquadFilter();

      // Delay Chain
      const delayNode = ctx.createDelay(1.0);
      const delayGain = ctx.createGain();

      // Reverb Simulation Chain
      const reverbNode = ctx.createDelay(0.1);
      const reverbGain = ctx.createGain();

      source.buffer = buffer;
      source.playbackRate.value = settings.pitch;
      gainNode.gain.value = settings.volume;
      panNode.pan.value = settings.pan || 0;

      filterNode.type = 'lowpass';
      filterNode.frequency.value = 200 + (Math.pow(settings.cutoff, 2) * 19800);

      // Primary Routing
      source.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(ctx.destination);

      // Delay Routing
      if (settings.delay > 0) {
        delayNode.delayTime.value = 0.3;
        delayGain.gain.value = settings.delay * 0.7;

        gainNode.connect(delayNode);
        delayNode.connect(delayGain);
        delayGain.connect(delayNode); // feedback
        delayGain.connect(panNode);
      }

      // Reverb Routing
      if (settings.reverb > 0) {
        reverbNode.delayTime.value = 0.05;
        reverbGain.gain.value = settings.reverb * 0.5;

        gainNode.connect(reverbNode);
        reverbNode.connect(reverbGain);
        reverbGain.connect(reverbNode);
        reverbGain.connect(panNode);
      }

      source.start();
    } catch (error) {
      console.error("Playback error:", error);
    }
  }, [clips, loadAudio, initAudioContext, channelSettings]);

  const toggleCell = async (channelIdx: number, step: number) => {
    const clipId = selectedClipsForChannel[channelIdx.toString()];
    if (!clipId) {
      toast({ title: "Select a sound for this channel first!" });
      return;
    }

    const key = `${channelIdx}-${step}`;
    const newGrid = { ...grid };

    if (newGrid[key]?.includes(clipId)) {
      newGrid[key] = newGrid[key].filter(id => id !== clipId);
      if (newGrid[key].length === 0) delete newGrid[key];
    } else {
      newGrid[key] = [...(newGrid[key] || []), clipId];
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
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
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
    const newChannelIdx = numChannels;
    setNumChannels(prev => prev + 1);
    setChannelSettings(prev => ({
      ...prev,
      [newChannelIdx.toString()]: { ...DEFAULT_CHANNEL_SETTINGS, color: CHANNEL_COLORS[newChannelIdx % CHANNEL_COLORS.length].class }
    }));
    setSelectedClipsForChannel(prev => ({
      ...prev,
      [newChannelIdx.toString()]: ''
    }));
  };

  const removeChannel = (idxToRemove: number) => {
    if (numChannels <= 1) {
      toast({ title: "You need at least one channel!" });
      return;
    }

    const newNum = numChannels - 1;
    setNumChannels(newNum);

    const newGrid: Record<string, string[]> = {};
    Object.keys(grid).forEach(key => {
      const [c, s] = key.split('-').map(Number);
      if (c === idxToRemove) return;
      const newC = c > idxToRemove ? c - 1 : c;
      newGrid[`${newC}-${s}`] = grid[key];
    });
    setGrid(newGrid);

    const newSettings: Record<string, ChannelSettings> = {};
    const newSelected: Record<string, string> = {};

    for (let i = 0; i < numChannels; i++) {
      if (i === idxToRemove) continue;
      const targetIdx = i > idxToRemove ? i - 1 : i;
      newSettings[targetIdx.toString()] = channelSettings[i.toString()] || DEFAULT_CHANNEL_SETTINGS;
      newSelected[targetIdx.toString()] = selectedClipsForChannel[i.toString()] || '';
    }

    setChannelSettings(newSettings);
    setSelectedClipsForChannel(newSelected);
  };

  const saveCurrentTrack = () => {
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
    toast({ title: "Track saved to Drop It library!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Settings2 className="w-24 h-24" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-6 relative z-10">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-black bg-transparent border-none focus:ring-0 w-full md:w-auto outline-none text-primary"
            placeholder="Untitled Drop..."
          />

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3 bg-muted/40 px-4 py-2 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-muted-foreground">Tempo</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold w-12">{bpm} BPM</span>
                <input
                  type="range"
                  min="60"
                  max="200"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value))}
                  className="w-24 accent-primary cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 bg-muted/40 px-4 py-2 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-muted-foreground">Length</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold w-12">{numSteps} Steps</span>
                <input
                  type="range"
                  min="4"
                  max={MAX_STEPS}
                  step="4"
                  value={numSteps}
                  onChange={(e) => setNumSteps(parseInt(e.target.value))}
                  className="w-24 accent-accent cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <Button
            variant={isPlaying ? "destructive" : "default"}
            className="rounded-full px-8 h-12 font-bold shadow-lg"
            onClick={handlePlayToggle}
          >
            {isPlaying ? <Square className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
            {isPlaying ? "Stop" : "Play Beat"}
          </Button>
          <Button variant="outline" className="rounded-full h-12 px-6 font-bold" onClick={saveCurrentTrack}>
            <Save className="w-5 h-5 mr-2" /> Save Creation
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] w-full p-8 shadow-sm border overflow-x-auto">
        <div className="space-y-10 w-full " >
          {Array.from({ length: numChannels }).map((_, channelIdx) => {
            const settings = channelSettings[channelIdx.toString()] || DEFAULT_CHANNEL_SETTINGS;
            const selectedClipId = selectedClipsForChannel[channelIdx.toString()] || '';

            return (
              <div key={channelIdx} className="flex items-start gap-10 group animate-in fade-in slide-in-from-left-4">
                <div className="w-[30%] flex flex-col gap-5 pr-8 border-r shrink-0 relative">
                  <div className="  w-[80%] flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        title="Audition Sound"
                        onClick={() => {
                          if (selectedClipId) {
                            playClip(selectedClipId, channelIdx.toString());
                          } else {
                            toast({ title: "Select a sound first!" });
                          }
                        }}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner hover:scale-110 active:scale-95 transition-all",
                          settings.color, 
                          "bg-opacity-20"
                        )}
                      >
                        <Music className={cn("w-5 h-5", settings.color.replace('bg-', 'text-'))} />
                      </button>
                      <select
                        className="text-xs bg-transparent focus:outline-none font-black text-primary truncate w-full cursor-pointer hover:underline uppercase tracking-widest"
                        value={selectedClipId}
                        onChange={(e) => {
                          setSelectedClipsForChannel(prev => ({
                            ...prev,
                            [channelIdx.toString()]: e.target.value
                          }));
                        }}
                      >
                        <option value="">Select Sound...</option>
                        {clips.map(clip => (
                          <option key={clip.id} value={clip.id}>{clip.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-1 ml-2">
                      {CHANNEL_COLORS.map(c => (
                        <button
                          key={c.name}
                          onClick={() => updateChannelSetting(channelIdx, 'color', c.class)}
                          className={cn(
                            "w-3 h-3 rounded-full transition-transform hover:scale-125",
                            c.class,
                            settings.color === c.class ? "ring-2 ring-offset-2 ring-muted-foreground" : "opacity-40"
                          )}
                          title={c.name}
                        />
                      ))}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-4 top-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-white h-8 w-8 rounded-full"
                      onClick={() => removeChannel(channelIdx)}
                    >
                      <Trash2 className="w-4 h-4 hover:text-white hover:stroke-white " />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 px-1">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">
                        <div className="flex items-center gap-1"><Volume2 className="w-2.5 h-2.5" /> Volume</div>
                        <span>{Math.round(settings.volume * 100)}%</span>
                      </div>
                      <Slider
                        value={[settings.volume * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(val) => updateChannelSetting(channelIdx, 'volume', val[0] / 100)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">
                          <div className="flex items-center gap-1"><Waves className="w-2.5 h-2.5" /> Pitch</div>
                        </div>
                        <Slider
                          value={[settings.pitch * 50]}
                          min={25}
                          max={100}
                          step={1}
                          onValueChange={(val) => updateChannelSetting(channelIdx, 'pitch', val[0] / 50)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">
                          <div className="flex items-center gap-1"><MoveHorizontal className="w-2.5 h-2.5" /> Pan</div>
                        </div>
                        <Slider
                          value={[(settings.pan + 1) * 50]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(val) => updateChannelSetting(channelIdx, 'pan', (val[0] / 50) - 1)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">
                          <div className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Delay</div>
                        </div>
                        <Slider
                          value={[settings.delay * 100]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(val) => updateChannelSetting(channelIdx, 'delay', val[0] / 100)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">
                          <div className="flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> Reverb</div>
                        </div>
                        <Slider
                          value={[settings.reverb * 100]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(val) => updateChannelSetting(channelIdx, 'reverb', val[0] / 100)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">
                        <div className="flex items-center gap-1"><Filter className="w-2.5 h-2.5" /> Filter Cutoff</div>
                        <span>{Math.round(settings.cutoff * 100)}%</span>
                      </div>
                      <Slider
                        value={[settings.cutoff * 100]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(val) => updateChannelSetting(channelIdx, 'cutoff', val[0] / 100)}
                      />
                    </div>
                  </div>


                </div>

                <div className="flex-1 max-w-[70%] overflow-x-scroll flex gap-2 h-36 pt-1">
                  {Array.from({ length: numSteps }).map((_, stepIdx) => {
                    const clipIds = grid[`${channelIdx}-${stepIdx}`] || [];
                    const clipId = clipIds[0];
                    const clip = clips.find(c => c.id === clipId);
                    const character = CHARACTER_TYPES.find(ct => ct.id === clip?.characterType);
                    const CharIcon = character?.icon;
                    const isMajorBeat = stepIdx % 4 === 0;

                    return (
                      <button
                        key={stepIdx}
                        onClick={() => toggleCell(channelIdx, stepIdx)}
                        className={cn(
                          "w-10 rounded-2xl transition-all flex items-center justify-center relative overflow-hidden group/cell shrink-0",
                          stepIdx === currentStep ? "ring-4 ring-accent ring-offset-2 z-10" : "",
                          clip
                            ? `${settings.color} text-white scale-100 shadow-lg border-b-8 border-black/20 translate-y-[-2px]`
                            : "bg-muted/30 hover:bg-muted/50 scale-95",
                          isMajorBeat && !clip ? "bg-muted/60" : ""
                        )}
                      >
                        {CharIcon && (
                          <CharIcon
                            className={cn(
                              "w-8 h-8 opacity-95 transition-transform group-hover/cell:scale-125",
                              stepIdx === currentStep ? "animate-bounce" : "animate-bounce-subtle"
                            )}
                          />
                        )}
                        {stepIdx === currentStep && !clip && (
                          <div className="absolute inset-0 bg-accent/30" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <Button
            variant="outline"
            className="w-full border-dashed border-4 py-10 rounded-3xl gap-3 hover:bg-primary/5 hover:border-primary transition-all group"
            onClick={addChannel}
          >
            <Plus className="w-6 h-6 group-hover:scale-150 transition-transform text-primary" />
            <span className="font-black uppercase tracking-[0.3em] text-xs text-primary">Add Instrument Track</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
