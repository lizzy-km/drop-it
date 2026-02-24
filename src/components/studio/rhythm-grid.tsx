
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Music, Save, Volume2, Waves, Clock, MoveHorizontal, Filter } from 'lucide-react';
import { db, User, AudioClip, Track, ChannelSettings } from '@/lib/db';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';

const STEPS = 16;
const CHANNELS = 4;

const DEFAULT_CHANNEL_SETTINGS: ChannelSettings = {
  volume: 0.8,
  pitch: 1.0,
  delay: 0,
  pan: 0,
  cutoff: 1.0,
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
  const [grid, setGrid] = useState<Record<string, string[]>>(track?.grid || {});
  const [channelSettings, setChannelSettings] = useState<Record<string, ChannelSettings>>(
    track?.channelSettings || 
    Object.fromEntries(Array.from({ length: CHANNELS }).map((_, i) => [i.toString(), { ...DEFAULT_CHANNEL_SETTINGS }]))
  );
  const [selectedClipsForChannel, setSelectedClipsForChannel] = useState<string[]>(new Array(CHANNELS).fill(''));
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

  const playClip = useCallback(async (clipId: string, channelIdx: number) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    const settings = channelSettings[channelIdx.toString()] || DEFAULT_CHANNEL_SETTINGS;

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
      const delayNode = ctx.createDelay(1.0);
      const feedbackNode = ctx.createGain();

      source.buffer = buffer;
      source.playbackRate.value = settings.pitch;
      gainNode.gain.value = settings.volume;
      panNode.pan.value = settings.pan || 0;
      
      filterNode.type = 'lowpass';
      // Map 0-1 to 200Hz - 20000Hz exponentially-ish
      filterNode.frequency.value = 200 + (Math.pow(settings.cutoff, 2) * 19800);

      // Audio Chain: source -> filter -> gain -> panner -> destination
      source.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(panNode);
      panNode.connect(ctx.destination);

      // Wet Path (Delay)
      if (settings.delay > 0) {
        delayNode.delayTime.value = 0.3; // Fixed delay time for now
        feedbackNode.gain.value = settings.delay * 0.7; // Feedback mix
        
        gainNode.connect(delayNode);
        delayNode.connect(feedbackNode);
        feedbackNode.connect(delayNode);
        delayNode.connect(panNode);
      }
      
      source.start();
    } catch (error) {
      console.error("Playback error:", error);
    }
  }, [clips, loadAudio, initAudioContext, channelSettings]);

  const toggleCell = async (channel: number, step: number) => {
    const clipId = selectedClipsForChannel[channel];
    if (!clipId) {
      toast({ title: "Select a sound for this channel first!" });
      return;
    }

    const key = `${channel}-${step}`;
    const newGrid = { ...grid };
    
    if (newGrid[key]?.includes(clipId)) {
      newGrid[key] = newGrid[key].filter(id => id !== clipId);
      if (newGrid[key].length === 0) delete newGrid[key];
    } else {
      newGrid[key] = [...(newGrid[key] || []), clipId];
      await playClip(clipId, channel);
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
          const next = (prev + 1) % STEPS;
          for (let c = 0; c < CHANNELS; c++) {
            const clipIds = grid[`${c}-${next}`];
            if (clipIds) {
              clipIds.forEach(id => playClip(id, c));
            }
          }
          return next;
        });
      }, stepInterval);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, bpm, grid, playClip]);

  const updateChannelSetting = (channelIdx: number, key: keyof ChannelSettings, value: number) => {
    setChannelSettings(prev => ({
      ...prev,
      [channelIdx.toString()]: {
        ...prev[channelIdx.toString()] || DEFAULT_CHANNEL_SETTINGS,
        [key]: value
      }
    }));
  };

  const saveCurrentTrack = () => {
    const newTrack: Track = {
      id: track?.id || crypto.randomUUID(),
      userId: user.id,
      title,
      bpm,
      grid,
      channelSettings,
      createdAt: Date.now()
    };
    db.saveTrack(newTrack);
    onSaveTrack(newTrack);
    toast({ title: "Track saved to Drop It library!" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border">
        <div className="flex items-center gap-4">
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-bold bg-transparent border-none focus:ring-0 w-full md:w-auto outline-none"
            placeholder="Untitled Drop..."
          />
          <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-xs font-bold">
            <span>{bpm} BPM</span>
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

        <div className="flex items-center gap-2">
          <Button 
            variant={isPlaying ? "destructive" : "default"} 
            className="rounded-full px-6"
            onClick={handlePlayToggle}
          >
            {isPlaying ? <Square className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isPlaying ? "Stop" : "Play Beat"}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={saveCurrentTrack}>
             <Save className="w-4 h-4 mr-2" /> Save Creation
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border overflow-x-auto">
        <div className="min-w-[1000px] space-y-8">
          {Array.from({ length: CHANNELS }).map((_, channelIdx) => {
            const settings = channelSettings[channelIdx.toString()] || DEFAULT_CHANNEL_SETTINGS;
            
            return (
              <div key={channelIdx} className="flex items-start gap-8">
                {/* Channel Mixer strip */}
                <div className="w-72 flex flex-col gap-4 pr-6 border-r shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 shadow-inner">
                      <Music className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <select 
                      className="text-xs bg-transparent focus:outline-none font-bold text-primary truncate w-full cursor-pointer hover:underline"
                      value={selectedClipsForChannel[channelIdx]}
                      onChange={(e) => {
                        const newArr = [...selectedClipsForChannel];
                        newArr[channelIdx] = e.target.value;
                        setSelectedClipsForChannel(newArr);
                      }}
                    >
                      <option value="">Select Sound...</option>
                      {clips.map(clip => (
                        <option key={clip.id} value={clip.id}>{clip.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* FL Studio style FX knobs represented as sliders */}
                  <div className="grid grid-cols-1 gap-3 px-1">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-tighter">
                        <div className="flex items-center gap-1"><Volume2 className="w-2.5 h-2.5" /> Vol</div>
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

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-tighter">
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
                       <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-tighter">
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

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-tighter">
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
                       <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] uppercase font-black text-muted-foreground/60 tracking-tighter">
                            <div className="flex items-center gap-1"><Filter className="w-2.5 h-2.5" /> Cutoff</div>
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
                </div>

                {/* Step Sequencer */}
                <div className="flex-1 grid grid-cols-16 gap-2 h-32 pt-1">
                  {Array.from({ length: STEPS }).map((_, stepIdx) => {
                    const clipIds = grid[`${channelIdx}-${stepIdx}`] || [];
                    const clipId = clipIds[0];
                    const clip = clips.find(c => c.id === clipId);
                    const character = CHARACTER_TYPES.find(ct => ct.id === clip?.characterType);
                    const CharIcon = character?.icon;
                    
                    return (
                      <button
                        key={stepIdx}
                        onClick={() => toggleCell(channelIdx, stepIdx)}
                        className={cn(
                          "rounded-2xl transition-all flex items-center justify-center relative overflow-hidden group/cell",
                          stepIdx === currentStep ? "ring-4 ring-accent ring-offset-2 z-10" : "",
                          clip 
                            ? "bg-primary text-white scale-100 shadow-lg border-b-8 border-primary/50 translate-y-[-2px]" 
                            : "bg-muted/30 hover:bg-muted/50 scale-95",
                          stepIdx % 4 === 0 && !clip ? "bg-muted/50" : ""
                        )}
                      >
                        {CharIcon && (
                          <CharIcon 
                            className={cn(
                              "w-12 h-12 opacity-90 transition-transform group-hover/cell:scale-110", 
                              stepIdx === currentStep ? "animate-bounce" : "animate-bounce-subtle"
                            )} 
                          />
                        )}
                        {stepIdx === currentStep && !clip && (
                          <div className="absolute inset-0 bg-accent/20" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-12 flex flex-wrap justify-center gap-12 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 rounded-md bg-primary shadow-sm" /> Active Step
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 rounded-md bg-muted/60 shadow-inner" /> Major Beat
           </div>
           <div className="flex items-center gap-2">
             <div className="w-4 h-4 rounded-md ring-2 ring-accent ring-offset-2" /> Playhead
           </div>
        </div>
      </div>
    </div>
  );
}
