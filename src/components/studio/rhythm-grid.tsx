
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Plus, Trash2, Layers, Music } from 'lucide-react';
import { db, User, AudioClip, Track } from '@/lib/db';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const STEPS = 16;
const CHANNELS = 4;

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
  const [selectedClipsForChannel, setSelectedClipsForChannel] = useState<string[]>(new Array(CHANNELS).fill(''));
  const [title, setTitle] = useState(track?.title || 'My First Drop');

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});

  const loadAudio = useCallback(async (clip: AudioClip) => {
    if (audioBuffersRef.current[clip.id]) return audioBuffersRef.current[clip.id];
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const res = await fetch(clip.audioData);
    const arrayBuffer = await res.arrayBuffer();
    const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
    audioBuffersRef.current[clip.id] = audioBuffer;
    return audioBuffer;
  }, []);

  const playClip = useCallback(async (clipId: string) => {
    const clip = clips.find(c => c.id === clipId);
    if (!clip || !audioContextRef.current) return;

    const buffer = await loadAudio(clip);
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  }, [clips, loadAudio]);

  const toggleCell = (channel: number, step: number) => {
    const clipId = selectedClipsForChannel[channel];
    if (!clipId) {
      toast({ title: "Select a clip for this channel first!" });
      return;
    }

    const key = `${channel}-${step}`;
    const newGrid = { ...grid };
    if (newGrid[key]?.includes(clipId)) {
      newGrid[key] = newGrid[key].filter(id => id !== clipId);
      if (newGrid[key].length === 0) delete newGrid[key];
    } else {
      newGrid[key] = [...(newGrid[key] || []), clipId];
      // Preview sound when placing
      playClip(clipId);
    }
    setGrid(newGrid);
  };

  const handlePlayToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setCurrentStep(-1);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
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
          // Play sounds in this step across all channels
          for (let c = 0; c < CHANNELS; c++) {
            const clipIds = grid[`${c}-${next}`];
            if (clipIds) {
              clipIds.forEach(id => playClip(id));
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

  const saveCurrentTrack = () => {
    const newTrack: Track = {
      id: track?.id || crypto.randomUUID(),
      userId: user.id,
      title,
      bpm,
      grid,
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
            className="text-xl font-bold bg-transparent border-none focus:ring-0 w-full md:w-auto"
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
              className="w-24 accent-primary"
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
             Save Creation
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border overflow-x-auto">
        <div className="min-w-[800px] space-y-4">
          {Array.from({ length: CHANNELS }).map((_, channelIdx) => (
            <div key={channelIdx} className="flex items-center gap-4">
              <div className="w-48 flex items-center gap-3 pr-2 border-r">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5 text-muted-foreground" />
                </div>
                <select 
                  className="text-xs bg-transparent focus:outline-none font-semibold text-primary truncate w-full"
                  value={selectedClipsForChannel[channelIdx]}
                  onChange={(e) => {
                    const newArr = [...selectedClipsForChannel];
                    newArr[channelIdx] = e.target.value;
                    setSelectedClipsForChannel(newArr);
                  }}
                >
                  <option value="">Choose Sound...</option>
                  {clips.map(clip => (
                    <option key={clip.id} value={clip.id}>{clip.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex-1 grid grid-cols-16 gap-1.5 h-14">
                {Array.from({ length: STEPS }).map((_, stepIdx) => {
                  const clipIds = grid[`${channelIdx}-${stepIdx}`] || [];
                  const clipId = clipIds[0]; // Simplified for now
                  const clip = clips.find(c => c.id === clipId);
                  const CharIcon = CHARACTER_TYPES.find(ct => ct.id === clip?.characterType)?.icon;
                  
                  return (
                    <button
                      key={stepIdx}
                      onClick={() => toggleCell(channelIdx, stepIdx)}
                      className={cn(
                        "rounded-lg transition-all flex items-center justify-center relative overflow-hidden",
                        stepIdx === currentStep ? "ring-2 ring-accent ring-offset-2" : "",
                        clip 
                          ? "bg-primary text-white scale-100 shadow-sm" 
                          : "bg-muted/30 hover:bg-muted scale-95",
                        stepIdx % 4 === 0 && !clip ? "bg-muted/60" : ""
                      )}
                    >
                      {CharIcon && (
                        <CharIcon 
                          className={cn(
                            "w-8 h-8 opacity-90", 
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
          ))}
        </div>
        
        <div className="mt-8 flex justify-center gap-12 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded bg-primary" /> Active Clip
           </div>
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded bg-muted/60" /> Beat Highlight
           </div>
           <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded ring-2 ring-accent" /> Playhead
           </div>
        </div>
      </div>
    </div>
  );
}
