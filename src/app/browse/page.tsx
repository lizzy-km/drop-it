
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { db, User, Track, AudioClip, ChannelSettings } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Heart, Play, Music, Square, Loader2, Trash2, Edit3, Copy, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { toast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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

export default function BrowsePage() {
  const [creations, setCreations] = useState<any[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const router = useRouter();
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const reversedBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const masterCompressorRef = useRef<DynamicsCompressorNode | null>(null);

  useEffect(() => {
    setCreations(db.getAllCreations());
    setCurrentUser(db.getCurrentUser());
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-12, ctx.currentTime);
      compressor.knee.setValueAtTime(30, ctx.currentTime);
      compressor.ratio.setValueAtTime(4, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.25, ctx.currentTime);
      compressor.connect(ctx.destination);
      masterCompressorRef.current = compressor;
      audioContextRef.current = ctx;
    }
    return audioContextRef.current;
  };

  const getReversedBuffer = (originalBuffer: AudioBuffer, clipId: string) => {
    if (reversedBuffersRef.current[clipId]) return reversedBuffersRef.current[clipId];
    const reversedBuffer = new AudioBuffer({
      length: originalBuffer.length,
      numberOfChannels: originalBuffer.numberOfChannels,
      sampleRate: originalBuffer.sampleRate
    });
    for (let i = 0; i < originalBuffer.numberOfChannels; i++) {
      const originalData = originalBuffer.getChannelData(i);
      const reversedData = reversedBuffer.getChannelData(i);
      for (let j = 0; j < originalBuffer.length; j++) {
        reversedData[j] = originalData[originalBuffer.length - 1 - j];
      }
    }
    reversedBuffersRef.current[clipId] = reversedBuffer;
    return reversedBuffer;
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

  const playClip = (clipId: string, channelIdx: string, track: Track, ctx: AudioContext) => {
    let buffer = audioBuffersRef.current[clipId];
    if (!buffer) return;

    const settings = track.channelSettings[channelIdx];
    if (!settings || settings.muted) return;

    if (settings.reversed) {
      buffer = getReversedBuffer(buffer, clipId);
    }

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();
    const filterNode = ctx.createBiquadFilter();
    const panNode = ctx.createStereoPanner();
    const distortionNode = ctx.createWaveShaper();
    
    // Pitch calculation including Auto-Tune simulation
    let finalPitch = settings.pitch ?? 1.0;
    if (settings.autoTune > 0) {
      const semitoneFactor = Math.pow(2, 1/12);
      const currentSteps = Math.log(finalPitch) / Math.log(semitoneFactor);
      const snappedPitch = Math.pow(semitoneFactor, Math.round(currentSteps));
      finalPitch = (finalPitch * (1 - settings.autoTune)) + (snappedPitch * settings.autoTune);
    }

    source.buffer = buffer;
    source.playbackRate.value = finalPitch;
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(settings.volume ?? 0.8, ctx.currentTime + (settings.attack || 0));
    
    panNode.pan.value = settings.pan || 0;
    filterNode.frequency.value = 200 + (Math.pow(settings.cutoff || 1, 2) * 19800);
    
    if (settings.distortion > 0) {
      distortionNode.curve = makeDistortionCurve(settings.distortion);
      distortionNode.oversample = '4x';
    }

    const trimStart = (settings.trimStart || 0) * buffer.duration;
    const trimEnd = (settings.trimEnd || 1) * buffer.duration;
    const playDuration = Math.max(0, trimEnd - trimStart) / finalPitch;

    // Release envelope
    const releaseStartTime = ctx.currentTime + playDuration - (settings.release || 0.1);
    gainNode.gain.setValueAtTime(settings.volume ?? 0.8, Math.max(ctx.currentTime + (settings.attack || 0), releaseStartTime));
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + playDuration);

    source.connect(settings.distortion > 0 ? distortionNode : filterNode);
    if (settings.distortion > 0) distortionNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(masterCompressorRef.current || ctx.destination);

    source.start(0, trimStart, playDuration);
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

      const usedClipIds = new Set(Object.values(track.grid).flat());
      const allClips = db.getClips();
      const requiredClips = allClips.filter(c => usedClipIds.has(c.id));

      if (requiredClips.length === 0 && usedClipIds.size > 0) {
        throw new Error("Missing audio assets for this track");
      }

      await Promise.all(requiredClips.map(clip => loadAudio(clip)));

      setIsLoading(null);
      setPlayingTrackId(track.id);

      let currentStep = 0;
      const stepDuration = (60 / track.bpm) / 4;
      const stepInterval = stepDuration * 1000;

      timerRef.current = setInterval(() => {
        for (let ch = 0; ch < track.numChannels; ch++) {
          const clipIds = track.grid[`${ch}-${currentStep}`];
          if (clipIds) {
            clipIds.forEach(id => playClip(id, ch.toString(), track, ctx));
          }
        }
        currentStep = (currentStep + 1) % track.numSteps;
      }, stepInterval);

    } catch (err) {
      console.error(err);
      setIsLoading(null);
      toast({ title: "Playback Error", description: "Audio context could not start or assets missing.", variant: "destructive" });
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
