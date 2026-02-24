
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { db, User, Track, AudioClip } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Heart, Play, Music, Square, Loader2, Trash2, Edit3, Copy, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { toast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function BrowsePage() {
  const [creations, setCreations] = useState<any[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});

  useEffect(() => {
    setCreations(db.getAllCreations());
    setCurrentUser(db.getCurrentUser());
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  const loadAudio = async (clip: AudioClip) => {
    if (audioBuffersRef.current[clip.id]) return audioBuffersRef.current[clip.id];
    const ctx = initAudioContext();
    try {
      const res = await fetch(clip.audioData);
      const arrayBuffer = await res.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      audioBuffersRef.current[clip.id] = audioBuffer;
      return audioBuffer;
    } catch (e) {
      console.error("Audio Load Error:", e);
      return null;
    }
  };

  const playClip = (clipId: string, track: Track, ctx: AudioContext) => {
    const buffer = audioBuffersRef.current[clipId];
    if (!buffer) return;

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    
    // Find channel settings for this clip in the track
    let volume = 0.8;
    Object.keys(track.selectedClips).forEach(chIdx => {
      if (track.selectedClips[chIdx] === clipId) {
        volume = track.channelSettings[chIdx]?.volume ?? 0.8;
      }
    });

    source.buffer = buffer;
    gainNode.gain.value = volume;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(0);
  };

  const stopPlayback = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPlayingTrackId(null);
  };

  const handlePlayPreview = async (track: Track) => {
    if (playingTrackId === track.id) {
      stopPlayback();
      return;
    }

    stopPlayback();
    setIsLoading(track.id);

    try {
      const ctx = initAudioContext();
      if (ctx.state === 'suspended') await ctx.resume();

      const allClips = db.getClips();
      const usedClipIds = new Set(Object.values(track.grid).flat());
      const requiredClips = allClips.filter(c => usedClipIds.has(c.id));

      if (requiredClips.length === 0 && usedClipIds.size > 0) {
        throw new Error("Missing audio assets for this track");
      }

      await Promise.all(requiredClips.map(clip => loadAudio(clip)));

      setIsLoading(null);
      setPlayingTrackId(track.id);

      let currentStep = 0;
      const stepInterval = (60 / track.bpm) / 4 * 1000;

      timerRef.current = setInterval(() => {
        for (let ch = 0; ch < track.numChannels; ch++) {
          const clipIds = track.grid[`${ch}-${currentStep}`];
          if (clipIds) {
            clipIds.forEach(id => playClip(id, track, ctx));
          }
        }
        currentStep = (currentStep + 1) % track.numSteps;
      }, stepInterval);

    } catch (err) {
      console.error(err);
      setIsLoading(null);
      toast({ title: "Playback Error", description: "Could not load studio assets.", variant: "destructive" });
    }
  };

  const handleDelete = (id: string) => {
    db.deleteTrack(id);
    setCreations(db.getAllCreations());
    toast({ title: "Track Deleted" });
  };

  const handleRemix = (track: Track) => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "Select a profile first." });
      return;
    }
    const newTrack = {
      ...track,
      id: crypto.randomUUID(),
      userId: currentUser.id,
      title: `REMIX_OF_${track.title}`,
      createdAt: Date.now()
    };
    db.saveTrack(newTrack);
    toast({ title: "Track Remixed!", description: "Copied to your studio." });
    router.push('/studio?id=' + newTrack.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-10 py-6 sticky top-0 z-50 gold-border">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-2xl text-foreground hover:bg-muted">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-4xl font-black tracking-tighter text-primary italic uppercase">Community_Hub</h1>
          </div>
          <Link href="/studio">
             <Button className="rounded-full bg-primary hover:bg-primary/90 px-8 h-12 font-black text-black uppercase tracking-widest text-xs">
               Enter Studio
             </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-10 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
          {creations.length === 0 ? (
            <div className="col-span-full py-32 text-center glass-panel rounded-[3rem] border-dashed border-2">
              <Music className="w-20 h-20 text-primary/20 mx-auto mb-6" />
              <h2 className="text-3xl font-black text-muted-foreground uppercase tracking-tighter">No drops detected.</h2>
              <p className="text-muted-foreground mt-4 font-bold">Be the first to record a sound and arrange a beat!</p>
            </div>
          ) : (
            creations.map((track) => (
              <div key={track.id} className="bg-card rounded-[3rem] overflow-hidden shadow-2xl border border-primary/20 hover:border-primary/50 transition-all duration-500 group gold-shadow">
                <div className="p-10 space-y-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img src={track.user?.avatar || 'https://picsum.photos/seed/default/200'} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-primary/20" alt="" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-card" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-xl leading-none text-primary italic tracking-tight uppercase truncate max-w-[150px]">{track.title}</h3>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-1 block">@{track.user?.name.replace(/\s+/g, '_').toLowerCase()}</span>
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full text-primary hover:bg-primary/10">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="glass-panel border-primary/20 rounded-2xl p-2 min-w-[160px]">
                        {currentUser?.id === track.userId && (
                          <DropdownMenuItem className="focus:bg-primary/10 rounded-xl cursor-pointer py-3" onClick={() => router.push(`/studio?id=${track.id}`)}>
                            <Edit3 className="w-4 h-4 mr-3 text-primary" /> <span className="text-xs font-black uppercase">Edit Signal</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="focus:bg-primary/10 rounded-xl cursor-pointer py-3" onClick={() => handleRemix(track)}>
                          <Copy className="w-4 h-4 mr-3 text-primary" /> <span className="text-xs font-black uppercase">Remix / Copy</span>
                        </DropdownMenuItem>
                        {currentUser?.id === track.userId && (
                          <DropdownMenuItem className="focus:bg-destructive/10 text-destructive rounded-xl cursor-pointer py-3" onClick={() => handleDelete(track.id)}>
                            <Trash2 className="w-4 h-4 mr-3" /> <span className="text-xs font-black uppercase">Destroy</span>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="bg-black/40 rounded-[2.5rem] p-10 relative group/visualizer overflow-hidden h-40 flex items-center justify-center border border-white/5 shadow-inner">
                     <div className="absolute inset-0 studio-grid-bg opacity-10" />
                     <div className="flex gap-4 relative z-10">
                        {CHARACTER_TYPES.slice(0, 3).map((ct, i) => (
                          <ct.icon key={i} className={`w-14 h-14 ${ct.color} animate-bounce-subtle`} style={{ animationDelay: `${i * 0.2}s` }} />
                        ))}
                     </div>
                     <button 
                        onClick={() => handlePlayPreview(track)}
                        className="absolute inset-0 bg-primary/20 backdrop-blur-sm opacity-0 group-hover/visualizer:opacity-100 transition-all flex items-center justify-center z-20 cursor-pointer"
                     >
                        {isLoading === track.id ? (
                          <Loader2 className="w-14 h-14 text-white animate-spin" />
                        ) : playingTrackId === track.id ? (
                          <Square className="w-14 h-14 text-white fill-white" />
                        ) : (
                          <Play className="w-14 h-14 text-white fill-white" />
                        )}
                     </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Music className="w-3.5 h-3.5 text-primary/60" />
                      {track.bpm} BPM
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] font-black text-primary/40 hover:text-primary">
                      <Heart className="w-3.5 h-3.5 mr-1" /> LIKE
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
