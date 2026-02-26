
"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { db, User } from '@/lib/db';
import { UserPlus, ArrowRight, Activity, Zap, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/brand/logo';

export default function LandingPage() {
  const [users, setUsers] = useState<User[]>([]);
  const router = useRouter();

  const appFeatures = [
    "Sample-Accurate Look-Ahead Engine",
    "Waveform & ADSR Editor",
    "High-Fidelity WAV Export",
    "Portable Project JSON Configs",
    "Pattern Generation Tools",
    "High-Gain Sample Recorder"
  ];

  useEffect(() => {
    setUsers(db.getUsers());
  }, []);

  const handleSelectUser = (user: User) => {
    db.setCurrentUser(user.id);
    router.push('/studio');
  };

  const createNewUser = () => {
    const name = prompt("IDENTIFY YOURSELF (DJ_NAME):");
    if (name) {
      const newUser: User = {
        id: crypto.randomUUID(),
        name,
        avatar: `https://picsum.photos/seed/${name}/400`
      };
      db.saveUser(newUser);
      setUsers([...users, newUser]);
      handleSelectUser(newUser);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden studio-grid-bg">
      <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-primary/10 rounded-full blur-[160px] pointer-events-none animate-pulse-gold" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />
      
      <div className="max-w-6xl w-full flex flex-col items-center text-center space-y-20 relative z-10 py-20">
        <div className="space-y-12 max-w-4xl flex flex-col items-center">
          <div className="animate-in fade-in zoom-in duration-1000">
            <Logo size={120} />
          </div>
          
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-white/5 border border-white/10 text-[10px] font-black tracking-[0.4em] uppercase text-primary animate-in fade-in slide-in-from-bottom-2">
              <Activity className="w-4 h-4 text-primary" />
              Web_Audio_Engine_Ready
            </div>
            <h1 className="text-8xl md:text-[10rem] font-black tracking-[-0.05em] leading-none animate-in fade-in slide-in-from-top-12 duration-1000">
              DROP <span className="text-primary italic">IT.</span>
            </h1>
            <p className="text-2xl md:text-3xl text-muted-foreground font-medium max-w-3xl mx-auto leading-relaxed animate-in fade-in duration-1000 delay-300">
              A high-performance workstation for rhythm design and audio mastering. 
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
          {appFeatures.map((feature, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-2xl animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${i * 0.1}s` }}>
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest text-left leading-tight">{feature}</span>
            </div>
          ))}
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-12">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelectUser(user)}
              className="group glass-panel p-10 rounded-[3rem] hover:bg-white/5 transition-all flex flex-col items-center gap-8 animate-in zoom-in duration-700 hover:scale-[1.02] gold-border"
            >
              <div className="relative">
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-32 h-32 rounded-[2.5rem] object-cover grayscale group-hover:grayscale-0 transition-all duration-700 shadow-2xl" 
                />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-4 border-[#050505] animate-bounce-subtle">
                   <Activity className="w-4 h-4 text-black" />
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-3xl group-hover:text-primary transition-colors tracking-tighter uppercase italic">{user.name}</h3>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.4em]">Launch_Studio</p>
              </div>
              <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all text-primary" />
            </button>
          ))}

          <button
            onClick={createNewUser}
            className="group p-10 rounded-[3rem] border-2 border-dashed border-white/10 hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-8 animate-in zoom-in duration-1000"
          >
            <div className="w-32 h-32 rounded-[2.5rem] bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-all duration-500 gold-border">
              <UserPlus className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="space-y-2">
              <h3 className="font-black text-3xl uppercase tracking-tighter">New_User</h3>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.4em]">Setup_Profile</p>
            </div>
          </button>
        </div>

        <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-700">
          <Link href="/browse">
            <Button variant="ghost" className="text-muted-foreground hover:text-primary font-black text-xs uppercase tracking-[0.5em] gap-3 px-12 rounded-full h-16 border border-white/5 hover:bg-white/5">
              Explore_Public_Library
            </Button>
          </Link>
          <div className="flex gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-20">
             <span>v1.0.0</span>
             <span>•</span>
             <span>Stable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
