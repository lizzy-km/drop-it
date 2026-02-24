"use client";

import React, { useEffect, useState } from 'react';
import { db, User, Track } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Heart, Play, User as UserIcon, Calendar, Music } from 'lucide-react';
import Link from 'next/link';
import { CHARACTER_TYPES } from '@/components/character-icons';

export default function BrowsePage() {
  const [creations, setCreations] = useState<any[]>([]);

  useEffect(() => {
    setCreations(db.getAllCreations());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-6 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full text-foreground hover:bg-muted">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-3xl font-black tracking-tighter text-primary">COMMUNITY DROPS</h1>
          </div>
          <Link href="/studio">
             <Button className="rounded-full bg-accent hover:bg-accent/90 px-6 font-bold text-accent-foreground">
               Go to Studio
             </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {creations.length === 0 ? (
            <div className="col-span-full py-24 text-center">
              <Music className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-muted-foreground">No drops yet.</h2>
              <p className="text-muted-foreground mt-2">Be the first to record a sound and arrange a beat!</p>
            </div>
          ) : (
            creations.map((track) => (
              <div key={track.id} className="bg-card rounded-[2.5rem] overflow-hidden shadow-xl border-t-8 border-primary hover:scale-[1.02] transition-transform duration-300">
                <div className="p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={track.user?.avatar || 'https://picsum.photos/seed/default/200'} className="w-12 h-12 rounded-2xl object-cover" alt="" />
                      <div>
                        <h3 className="font-bold text-lg leading-none">{track.title}</h3>
                        <span className="text-xs font-bold text-primary">{track.user?.name}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full text-accent hover:bg-accent/10">
                      <Heart className="w-6 h-6" />
                    </Button>
                  </div>

                  <div className="bg-muted/20 rounded-3xl p-6 relative group overflow-hidden h-32 flex items-center justify-center">
                     <div className="absolute inset-0 pixel-grid opacity-20" />
                     <div className="flex gap-2 relative z-10">
                        {Object.values(CHARACTER_TYPES).slice(0, 3).map((ct, i) => (
                          <ct.icon key={i} className={`w-12 h-12 ${ct.color} animate-bounce-subtle`} style={{ animationDelay: `${i * 0.2}s` }} />
                        ))}
                     </div>
                     <button className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                        <Play className="w-12 h-12 text-white fill-white" />
                     </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-black text-muted-foreground uppercase tracking-widest pt-2">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(track.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5" />
                      {track.bpm} BPM
                    </div>
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