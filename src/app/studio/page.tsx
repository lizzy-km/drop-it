
"use client";

import React, { useEffect, useState } from 'react';
import { db, User, AudioClip, Track } from '@/lib/db';
import { VoiceRecorder } from '@/components/studio/voice-recorder';
import { AudioUploader } from '@/components/studio/audio-uploader';
import { RhythmGrid } from '@/components/studio/rhythm-grid';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Music2, Share2, Library, Trash2 } from 'lucide-react';
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
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
            <div>
              <h2 className="font-bold leading-none">{user.name}</h2>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Studio Session</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/browse">
            <Button variant="ghost" className="rounded-full font-bold gap-2 text-primary">
              <Share2 className="w-4 h-4" /> Discover
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Top Controls: Sequencer Area */}
        <section>
          <RhythmGrid user={user} clips={clips} onSaveTrack={() => {}} />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Audio Assets Panel */}
          <div className="lg:col-span-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <VoiceRecorder user={user} onClipSaved={refreshClips} />
              <AudioUploader user={user} onClipSaved={refreshClips} />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border">
               <div className="flex items-center justify-between mb-4">
                 <h3 className="font-semibold text-lg flex items-center gap-2">
                   <Library className="w-5 h-5 text-accent" /> Sound Library
                 </h3>
                 <span className="text-xs font-bold text-muted-foreground uppercase">{clips.length} Sounds</span>
               </div>

               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                 {clips.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground font-medium border-2 border-dashed rounded-xl">
                       No sounds recorded yet. Use the panels above to start!
                    </div>
                 ) : (
                   clips.map(clip => {
                     const CharIcon = CHARACTER_TYPES.find(ct => ct.id === clip.characterType)?.icon || Music2;
                     return (
                       <div key={clip.id} className="group relative bg-muted/30 p-4 rounded-xl border flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                             <CharIcon className="w-8 h-8 text-primary" />
                          </div>
                          <span className="text-xs font-bold truncate w-full text-center">{clip.name}</span>
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteClip(clip.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                       </div>
                     );
                   })
                 )}
               </div>
            </div>
          </div>

          {/* Tips Panel */}
          <div className="lg:col-span-4 space-y-6">
             <div className="bg-primary text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Music2 className="w-32 h-32" />
                </div>
                <h3 className="text-xl font-bold mb-4 relative z-10">Pro Tip</h3>
                <ul className="space-y-4 relative z-10 text-sm font-medium text-white/90">
                  <li>• Pick a sound for each channel in the grid.</li>
                  <li>• Toggle cells to arrange your rhythm.</li>
                  <li>• Each sound has its own animated character!</li>
                  <li>• Save your creation and share it with the world.</li>
                </ul>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
