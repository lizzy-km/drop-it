"use client";

import React, { useEffect, useState } from 'react';
import { db, User, AudioClip } from '@/lib/db';
import { VoiceRecorder } from '@/components/studio/voice-recorder';
import { AudioUploader } from '@/components/studio/audio-uploader';
import { RhythmGrid } from '@/components/studio/rhythm-grid';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Disc, Library, Trash2, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CHARACTER_TYPES } from '@/components/character-icons';

export default function StudioPage() {
  const [user, setUser] = useState<User | null>(null);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const router = useRouter();

  useEffect(() => {
    const currentUser = db.getCurrentUser();
    if (!currentUser) {
      router.push('/');
      return;
    }
    setUser(currentUser);
    setClips(db.getClips(currentUser.id));
  }, [router]);

  const refreshClips = () => {
    if (user) setClips(db.getClips(user.id));
  };

  const deleteClip = (id: string) => {
    db.deleteClip(id);
    refreshClips();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-foreground pb-20 studio-grid-bg">
      {/* Top Navigation */}
      <header className="glass-panel border-b border-white/5 px-8 py-4 flex items-center justify-between sticky top-0 z-[100]">
        <div className="flex items-center gap-8">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-white hover:bg-white/10">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <img src={user.avatar} className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/10" alt="" />
            <div>
              <h2 className="text-xl font-black tracking-tight leading-none">{user.name.toUpperCase()}</h2>
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Studio Live</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link href="/browse">
             <Button variant="outline" className="rounded-full font-bold px-6 border-white/10 bg-transparent hover:bg-white/5">
               Explore Drops
             </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-8 py-10 space-y-12">
        {/* Main Sequencer Hero Section */}
        <section className="animate-in fade-in zoom-in-95 duration-700">
          <RhythmGrid user={user} clips={clips} onSaveTrack={() => {}} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Recording & Assets */}
          <div className="lg:col-span-8 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <VoiceRecorder user={user} onClipSaved={refreshClips} />
              <AudioUploader user={user} onClipSaved={refreshClips} />
            </div>

            {/* Compact Library View */}
            <div className="glass-panel rounded-[2.5rem] p-10 border-white/5">
               <div className="flex items-center justify-between mb-8">
                 <h3 className="text-2xl font-black flex items-center gap-3">
                   <Library className="w-6 h-6 text-primary" /> SOUND ASSETS
                 </h3>
                 <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] font-black text-muted-foreground tracking-widest uppercase">
                   {clips.length} Clips Loaded
                 </span>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                 {clips.length === 0 ? (
                    <div className="col-span-full py-16 text-center text-muted-foreground font-bold border-2 border-dashed border-white/5 rounded-3xl">
                       No assets found. Start recording!
                    </div>
                 ) : (
                   clips.map(clip => {
                     const CharIcon = CHARACTER_TYPES.find(ct => ct.id === clip.characterType)?.icon || Disc;
                     return (
                       <div key={clip.id} className="group relative bg-white/5 p-4 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-primary/20 flex flex-col items-center gap-3">
                          <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                             <CharIcon className="w-8 h-8 text-primary" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-center truncate w-full">{clip.name}</span>
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="absolute -top-2 -right-2 h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-xl"
                            onClick={() => deleteClip(clip.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                       </div>
                     );
                   })
                 )}
               </div>
            </div>
          </div>

          {/* Side Info/Stats */}
          <div className="lg:col-span-4 space-y-8">
             <div className="bg-primary p-8 rounded-[2.5rem] text-black relative overflow-hidden group shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                  <Disc className="w-48 h-48" />
                </div>
                <h3 className="text-3xl font-black italic mb-6">PRO WORKFLOW</h3>
                <div className="space-y-6 font-bold text-sm">
                  <div className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-xs shrink-0">1</div>
                    <p>Map your custom vocal recordings to any of the instrument tracks.</p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-xs shrink-0">2</div>
                    <p>Use the Mixer to sculpt each sound with Volume, Pitch, and Reverb.</p>
                  </div>
                  <div className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center text-xs shrink-0">3</div>
                    <p>Extend the sequence up to 64 steps for complex musical phrases.</p>
                  </div>
                </div>
             </div>

             <div className="glass-panel p-8 rounded-[2.5rem] space-y-4">
                <div className="flex items-center gap-3 text-primary">
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="font-black text-xs uppercase tracking-widest">Session Stats</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl text-center">
                    <div className="text-2xl font-black">{clips.length}</div>
                    <div className="text-[8px] font-black uppercase text-muted-foreground">Assets</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl text-center">
                    <div className="text-2xl font-black">1</div>
                    <div className="text-[8px] font-black uppercase text-muted-foreground">Active Project</div>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}