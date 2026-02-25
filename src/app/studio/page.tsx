
"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { db, User, AudioClip, Track } from '@/lib/db';
import { VoiceRecorder } from '@/components/studio/voice-recorder';
import { AudioUploader } from '@/components/studio/audio-uploader';
import { RhythmGrid } from '@/components/studio/rhythm-grid';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Library, Trash2, LayoutDashboard, Zap, Settings2, Loader2 } from 'lucide-react';
import ReactLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/brand/logo';

function StudioContent() {
  const [user, setUser] = useState<User | null>(null);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [loadedTrack, setLoadedTrack] = useState<Track | undefined>(undefined);
  const router = useRouter();
  const searchParams = useSearchParams();
  const trackId = searchParams.get('id');

  useEffect(() => {
    const currentUser = db.getCurrentUser();
    if (!currentUser) {
      router.push('/');
      return;
    }
    setUser(currentUser);
    setClips(db.getClips(currentUser.id));

    if (trackId) {
      const track = db.getTrack(trackId);
      if (track) setLoadedTrack(track);
    }
  }, [router, trackId]);

  const refreshClips = () => {
    const currentUser = db.getCurrentUser();
    if (currentUser) setClips(db.getClips(currentUser.id));
  };

  const deleteClip = (id: string) => {
    db.deleteClip(id);
    refreshClips();
  };

  const updateClipMetadata = (id: string, name: string, characterType: string) => {
    const allClips = db.getClips();
    const newAllClips = allClips.map(c => c.id === id ? { ...c, name, characterType } : c);
    localStorage.setItem('dropit_clips', JSON.stringify(newAllClips));
    if (user) setClips(newAllClips.filter(c => c.userId === user.id));
    toast({ title: "Asset Updated" });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 studio-grid-bg">
      <header className="glass-panel border-b border-primary/20 px-10 py-5 flex items-center justify-between sticky top-0 z-[100]">
        <div className="flex items-center gap-10">
          <ReactLink href="/">
            <Button variant="ghost" size="icon" className="rounded-2xl text-muted-foreground hover:text-primary hover:bg-primary/10">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </ReactLink>
          <Logo showText size={56} />
        </div>

        <div className="flex items-center gap-10">
          <div className="hidden md:flex flex-col items-end">
             <h2 className="text-xl font-black tracking-tighter leading-none text-primary uppercase">SESSION_{user.name.toUpperCase()}</h2>
             <div className="flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground">Studio Live</span>
             </div>
          </div>
          <div className="flex items-center gap-4 border-l border-white/5 pl-10">
            <ReactLink href="/browse">
               <Button variant="outline" className="rounded-full font-black px-8 h-12 border-primary/20 bg-black/20 hover:bg-primary/5 uppercase tracking-widest text-xs">
                 My Drop
               </Button>
            </ReactLink>
            <div className="relative">
              <img src={user.avatar} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-primary/30" alt="" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-4 border-background">
                <Zap className="w-2.5 h-2.5 text-black" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-10 py-12 space-y-16">
        <section className="animate-in fade-in zoom-in-95 duration-700">
          <RhythmGrid 
            key={loadedTrack?.id} 
            user={user} 
            clips={clips} 
            track={loadedTrack} 
            onSaveTrack={() => {}} 
            onImportRefresh={refreshClips}
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <VoiceRecorder user={user} onClipSaved={refreshClips} />
              <AudioUploader user={user} onClipSaved={refreshClips} />
            </div>

            <div className="glass-panel rounded-[2.5rem] p-12 gold-border">
               <div className="flex items-center justify-between mb-10">
                 <h3 className="text-3xl font-black flex items-center gap-4 italic tracking-tighter text-primary">
                   <Library className="w-7 h-7" /> SOUND_LIBRARY
                 </h3>
                 <span className="px-5 py-2 rounded-full bg-primary/10 text-[10px] font-black text-primary tracking-[0.2em] uppercase border border-primary/20">
                   {clips.length} SAMPLES_LOADED
                 </span>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                 {clips.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-muted-foreground font-black border-2 border-dashed border-primary/10 rounded-[2.5rem] bg-black/20">
                       NO_ASSETS_FOUND. RECORD_SAMPLES_TO_BEGIN.
                    </div>
                 ) : (
                   clips.map(clip => {
                     const charType = CHARACTER_TYPES.find(ct => ct.id === clip.characterType) || CHARACTER_TYPES[0];
                     const CharIcon = charType.icon;
                     return (
                       <div key={`${clip.id}${Math.random()}`} className="group relative bg-black/40 p-6 rounded-[2rem] hover:bg-primary/5 transition-all gold-border hover:border-primary/50 flex flex-col items-center gap-4">
                          <div className="w-16 h-16 bg-neutral-800 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform gold-border">
                             <CharIcon className={cn("w-9 h-9", charType.color)} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-center truncate w-full px-2">{clip.name}</span>
                          
                          <div className="absolute -top-3 -right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full shadow-2xl bg-primary text-black hover:bg-primary/90">
                                  <Settings2 className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="glass-panel border-primary/20 rounded-[2rem] p-10 gold-shadow">
                                <DialogHeader>
                                  <DialogTitle className="text-2xl font-black italic tracking-tighter text-primary uppercase">Edit Asset</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-8 py-6">
                                  <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Clip Name</Label>
                                    <input 
                                      defaultValue={clip.name}
                                      id={`clip-name-${clip.id}`}
                                      className="w-full bg-black/40 border border-primary/20 rounded-2xl p-4 text-primary font-black uppercase outline-none focus:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Visualizer</Label>
                                    <div className="grid grid-cols-4 gap-4">
                                      {CHARACTER_TYPES.map(ct => (
                                        <button 
                                          key={ct.id}
                                          onClick={() => {
                                             updateClipMetadata(clip.id, clip.name, ct.id);
                                          }}
                                          className={cn("p-4 rounded-2xl border-2 transition-all flex justify-center", clip.characterType === ct.id ? "border-primary bg-primary/10" : "border-transparent bg-black/20")}
                                        >
                                          <ct.icon className={cn("w-8 h-8", ct.color)} />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button 
                                    className="w-full bg-primary text-black font-black uppercase tracking-widest rounded-full h-12"
                                    onClick={() => {
                                      const input = document.getElementById(`clip-name-${clip.id}`) as HTMLInputElement;
                                      updateClipMetadata(clip.id, input.value.toUpperCase(), clip.characterType);
                                    }}
                                  >
                                    Save Changes
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button 
                              variant="destructive" 
                              size="icon" 
                              className="h-8 w-8 rounded-full shadow-2xl"
                              onClick={() => deleteClip(clip.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                       </div>
                     );
                   })
                 )}
               </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-10">
             <div className="bg-primary p-12 rounded-[3rem] text-black relative overflow-hidden group shadow-2xl gold-shadow">
                <h3 className="text-4xl font-black italic mb-8 tracking-tighter">STUDIO_GUIDE</h3>
                <div className="space-y-8 font-bold text-sm leading-relaxed">
                  <div className="flex gap-5 items-start">
                    <div className="w-8 h-8 rounded-2xl bg-black flex items-center justify-center text-xs text-primary shrink-0 font-black">01</div>
                    <p>Map custom recordings or uploads to any instrument track on the sequencer.</p>
                  </div>
                  <div className="flex gap-5 items-start">
                    <div className="w-8 h-8 rounded-2xl bg-black flex items-center justify-center text-xs text-primary shrink-0 font-black">02</div>
                    <p>Sculpt each channel using Volume, Pitch, Pan, and Filter controls.</p>
                  </div>
                </div>
             </div>

             <div className="glass-panel p-10 rounded-[3rem] space-y-6 gold-border">
                <div className="flex items-center gap-4 text-primary">
                  <LayoutDashboard className="w-6 h-6" />
                  <span className="font-black text-xs uppercase tracking-[0.3em]">SESSION_METRICS</span>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-black/40 p-6 rounded-[2rem] text-center gold-border">
                    <div className="text-3xl font-black text-primary">{clips.length}</div>
                    <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mt-1">Samples</div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div>}>
      <StudioContent />
    </Suspense>
  );
}
