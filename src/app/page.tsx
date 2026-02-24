"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { db, User } from '@/lib/db';
import { UserPlus, Play, Disc, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const [users, setUsers] = useState<User[]>([]);
  const router = useRouter();

  useEffect(() => {
    setUsers(db.getUsers());
  }, []);

  const handleSelectUser = (user: User) => {
    db.setCurrentUser(user.id);
    router.push('/studio');
  };

  const createNewUser = () => {
    const name = prompt("Enter your DJ Name:");
    if (name) {
      const newUser: User = {
        id: crypto.randomUUID(),
        name,
        avatar: `https://picsum.photos/seed/${name}/200`
      };
      db.saveUser(newUser);
      setUsers([...users, newUser]);
      handleSelectUser(newUser);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Cinematic Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="max-w-5xl w-full flex flex-col items-center text-center space-y-16 relative z-10">
        <div className="space-y-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold tracking-widest uppercase text-primary animate-in fade-in slide-in-from-bottom-2">
            <Disc className="w-3.5 h-3.5 animate-spin-slow" />
            Next Gen Rhythm Engine
          </div>
          <h1 className="text-7xl md:text-9xl font-black tracking-tighter leading-none animate-in fade-in slide-in-from-top-4 duration-700">
            DROP <span className="text-primary italic">IT.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-medium animate-in fade-in duration-1000">
            A minimalist workspace for high-fidelity sound creation. 
            Record your voice, layer rhythms, and animate your beats.
          </p>
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelectUser(user)}
              className="group glass-panel p-8 rounded-[2rem] hover:bg-white/10 transition-all flex flex-col items-center gap-6 animate-in zoom-in duration-500"
            >
              <div className="relative">
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-28 h-28 rounded-[2rem] object-cover grayscale group-hover:grayscale-0 transition-all duration-500" 
                />
                <div className="absolute inset-0 rounded-[2rem] border-2 border-transparent group-hover:border-primary/50 transition-all" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-2xl group-hover:text-primary transition-colors">{user.name}</h3>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Open Session</p>
              </div>
              <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary" />
            </button>
          ))}

          <button
            onClick={createNewUser}
            className="group p-8 rounded-[2rem] border-2 border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-6 animate-in zoom-in duration-700"
          >
            <div className="w-28 h-28 rounded-[2rem] bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <UserPlus className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-2xl">New Artist</h3>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Create Profile</p>
            </div>
          </button>
        </div>

        <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
          <Link href="/browse">
            <Button variant="ghost" className="text-muted-foreground hover:text-primary font-bold gap-2 px-8 rounded-full h-12">
              Browse Community Drops
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}