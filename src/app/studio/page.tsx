
"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { db, User, AudioClip, Track } from '@/lib/db';
import { VoiceRecorder } from '@/components/studio/voice-recorder';
import { AudioUploader } from '@/components/studio/audio-uploader';
import { RhythmGrid } from '@/components/studio/rhythm-grid';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Library, Trash2, LayoutDashboard, Settings2, Loader2, Mic2, Upload, Search, FolderOpen, Music, Plus } from 'lucide-react';
import ReactLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Logo } from '@/components/brand/logo';
import { ScrollArea } from '@/components/ui/scroll-area';

function StudioContent() {
  const [user, setUser] = useState<User | null>(null);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [loadedTrack, setLoadedTrack] = useState<Track | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'clips' | 'record' | 'import'>('clips');
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

  if (!user) return null;

  const uniqueClips = Array.from(new Map(clips.map(c => [c.id, c])).values());

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary selection:text-black">
      {/* DAW SIDE BROWSER */}
      <aside className="w-80 border-r border-white/5 flex flex-col bg-[#0a0a0a] z-50">
        <div className="p-6 border-b border-white/5 bg-black/40">
           <Logo showText size={32} />
        </div>

        <div className="flex border-b border-white/5">
           <button 
             onClick={() => setActiveTab('clips')}
             className={cn("flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-colors", activeTab === 'clips' ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-white")}
           >
             Browser
           </button>
           <button 
             onClick={() => setActiveTab('record')}
             className={cn("flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-colors", activeTab === 'record' ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-white")}
           >
             Record
           </button>
           <button 
             onClick={() => setActiveTab('import')}
             className={cn("flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-colors", activeTab === 'import' ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-white")}
           >
             Import
           </button>
        </div>

        <ScrollArea className="flex-1 p-4">
          {activeTab === 'clips' && (
            <div className="space-y-2">
               <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input className="w-full bg-white/5 rounded-lg pl-10 pr-4 py-2 text-[10px] font-bold outline-none border border-transparent focus:border-primary/20" placeholder="SEARCH_ASSETS..." />
               </div>
               
               <div className="flex items-center gap-2 px-2 py-3 text-[10px] font-black uppercase tracking-widest text-primary/40">
                  <FolderOpen className="w-3.5 h-3.5" /> 
                  User_Samples
               </div>

               {uniqueClips.length === 0 ? (
                 <div className="px-4 py-8 text-center border-2 border-dashed border-white/5 rounded-xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-relaxed">No local samples detected. Capture or import audio to begin.</p>
                 </div>
               ) : (
                 uniqueClips.map(clip => {
                   const charType = CHARACTER_TYPES.find(ct => ct.id === clip.characterType) || CHARACTER_TYPES[0];
                   const Icon = charType.icon;
                   return (
                     <div key={clip.id} className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/5">
                        <div className="w-8 h-8 rounded-md bg-black border border-white/10 flex items-center justify-center shrink-0">
                           <Icon className={cn("w-4 h-4", charType.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-black uppercase tracking-widest truncate">{clip.name}</p>
                           <p className="text-[8px] font-bold text-muted-foreground uppercase mt-0.5">WAV_AUDIO</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteClip(clip.id); }} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded">
                           <Trash2 className="w-3 h-3" />
                        </button>
                     </div>
                   );
                 })
               )}
            </div>
          )}

          {activeTab === 'record' && (
            <div className="p-2 space-y-6">
               <VoiceRecorder user={user} onClipSaved={refreshClips} />
            </div>
          )}

          {activeTab === 'import' && (
            <div className="p-2 space-y-6">
               <AudioUploader user={user} onClipSaved={refreshClips} />
            </div>
          )}
        </ScrollArea>

        <div className="p-6 border-t border-white/5 bg-black/40">
           <div className="flex items-center gap-4">
              <img src={user.avatar} className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/10" alt="" />
              <div className="min-w-0">
                 <p className="text-[10px] font-black uppercase tracking-widest truncate">{user.name}</p>
                 <p className="text-[8px] font-bold text-primary uppercase mt-0.5">Session_Online</p>
              </div>
           </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col bg-[#121212] relative overflow-hidden">
        <div className="absolute inset-0 studio-grid-bg opacity-[0.03] pointer-events-none" />
        
        {/* TRANSPORT / TOOLBAR */}
        <header className="h-20 border-b border-white/5 bg-[#0d0d0d] flex items-center justify-between px-10 relative z-40">
           <div className="flex items-center gap-8">
              <ReactLink href="/">
                <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl text-muted-foreground hover:text-white hover:bg-white/5">
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              </ReactLink>
              <div className="h-10 w-px bg-white/5" />
              <ReactLink href="/browse">
                 <Button variant="outline" className="h-10 rounded-xl border-white/10 bg-black/40 text-[10px] font-black uppercase tracking-widest hover:bg-white/5">
                    Project_Library
                 </Button>
              </ReactLink>
           </div>

           <div className="flex flex-col items-center">
              <span className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-1">Session_Workspace</span>
              <h2 className="text-xl font-black italic tracking-tighter text-white uppercase leading-none">
                {loadedTrack?.title || 'NEW_ARRANGEMENT_01'}
              </h2>
           </div>

           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 px-6 py-2 rounded-full bg-primary/10 border border-primary/20">
                 <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                 <span className="text-[9px] font-black text-primary uppercase tracking-widest">Master_Safe</span>
              </div>
           </div>
        </header>

        <div className="flex-1 p-8 overflow-y-auto relative z-10 custom-scrollbar">
           <div className="max-w-[1400px] mx-auto">
              <RhythmGrid 
                key={loadedTrack?.id || 'new-track'} 
                user={user} 
                clips={uniqueClips} 
                track={loadedTrack} 
                onSaveTrack={() => {}} 
                onImportRefresh={refreshClips}
              />
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
