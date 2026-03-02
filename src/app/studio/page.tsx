"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { db, User, AudioClip, Track } from '@/lib/db';
import { VoiceRecorder } from '@/components/studio/voice-recorder';
import { AudioUploader } from '@/components/studio/audio-uploader';
import { RhythmGrid } from '@/components/studio/rhythm-grid';
import { Button } from '@/components/ui/button';
import { 
  ChevronRight, Library, Trash2, Search, 
  FolderOpen, Music2, Mic2, Upload, 
  Menu, X, Volume2, Activity, HardDrive,
  Download, Plus
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/brand/logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';

function StudioContent() {
  const [user, setUser] = useState<User | null>(null);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [loadedTrack, setLoadedTrack] = useState<Track | undefined>(undefined);
  const [isBrowserOpen, setIsBrowserOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'samples' | 'record' | 'import'>('samples');
  
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
    if (currentUser) {
      const updatedClips = db.getClips(currentUser.id);
      setClips(updatedClips);
    }
  };

  const deleteClip = (id: string) => {
    db.deleteClip(id);
    refreshClips();
    toast({ title: "Sample Deleted" });
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0a0a] overflow-hidden">
      {/* DAW MAIN INTERFACE */}
      <div className="flex-1 flex overflow-hidden">
        {/* SURGICAL SIDE BROWSER */}
        <aside className={cn(
          "bg-[#111] border-r border-black transition-all duration-300 flex flex-col",
          isBrowserOpen ? "w-64" : "w-0 overflow-hidden"
        )}>
          <div className="h-12 border-b border-black flex items-center px-4 gap-3 bg-[#181c22]">
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Browser</span>
          </div>

          <div className="flex border-b border-black bg-[#151920]">
            <button onClick={() => setActiveTab('samples')} className={cn("flex-1 py-2 text-[9px] font-bold uppercase", activeTab === 'samples' ? "bg-primary/10 text-primary border-b border-primary" : "text-muted-foreground")}>Packs</button>
            <button onClick={() => setActiveTab('record')} className={cn("flex-1 py-2 text-[9px] font-bold uppercase", activeTab === 'record' ? "bg-primary/10 text-primary border-b border-primary" : "text-muted-foreground")}>Rec</button>
            <button onClick={() => setActiveTab('import')} className={cn("flex-1 py-2 text-[9px] font-bold uppercase", activeTab === 'import' ? "bg-primary/10 text-primary border-b border-primary" : "text-muted-foreground")}>Imp</button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {activeTab === 'samples' && (
                <>
                  <div className="text-[9px] font-bold text-primary/40 px-2 py-1 uppercase tracking-widest">User_Samples</div>
                  {clips.length === 0 ? (
                    <div className="p-4 text-center opacity-20">
                      <Music2 className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-[8px] font-black uppercase">No_Assets_Found</p>
                    </div>
                  ) : (
                    clips.map(clip => {
                      const ct = CHARACTER_TYPES.find(c => c.id === clip.characterType) || CHARACTER_TYPES[0];
                      return (
                        <div key={clip.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-white/5 cursor-pointer text-muted-foreground hover:text-white">
                          <ct.icon className={cn("w-3 h-3", ct.color)} />
                          <span className="text-[10px] font-bold uppercase truncate flex-1">{clip.name}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteClip(clip.id); }}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </>
              )}
              {activeTab === 'record' && <VoiceRecorder user={user} onClipSaved={refreshClips} />}
              {activeTab === 'import' && <AudioUploader user={user} onClipSaved={refreshClips} />}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-black bg-[#0d0f14] flex items-center gap-3">
             <img src={user.avatar} className="w-8 h-8 rounded-sm daw-button-outer" alt="" />
             <div className="min-w-0">
                <p className="text-[9px] font-black uppercase text-primary truncate leading-tight">{user.name}</p>
                <p className="text-[7px] font-bold text-muted-foreground uppercase">Producer_Session</p>
             </div>
          </div>
        </aside>

        {/* WORKSPACE AREA */}
        <main className="flex-1 flex flex-col bg-[#050505] relative studio-grid-bg">
          {/* TOGGLE BROWSER BUTTON */}
          <button 
            onClick={() => setIsBrowserOpen(!isBrowserOpen)}
            className="absolute left-0 top-[50%] -translate-y-[50%] w-3 h-12 bg-[#2d333b] hover:bg-primary/40 rounded-r-sm z-50 flex items-center justify-center daw-button-outer"
          >
            <ChevronRight className={cn("w-3 h-3 text-white transition-transform", isBrowserOpen && "rotate-180")} />
          </button>

          <div className="flex-1 w-auto  overflow-auto custom-scrollbar">
            <RhythmGrid user={user} clips={clips} track={loadedTrack} onSaveTrack={() => refreshClips()} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-black flex items-center justify-center">
      <Logo size={80} />
    </div>}>
      <StudioContent />
    </Suspense>
  );
}
