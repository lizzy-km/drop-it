"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { db, User } from '@/lib/db';
import { UserPlus, PlayCircle, Users } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl animate-pulse" />

      <div className="max-w-4xl w-full text-center space-y-12 relative z-10">
        <div className="space-y-4">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-primary animate-in fade-in slide-in-from-top-4 duration-1000">
            DROP IT<span className="text-accent">.</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground font-medium max-w-2xl mx-auto">
            The rhythm studio where every sound becomes a character. Record, arrange, and animate your music.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelectUser(user)}
              className="group bg-card p-6 rounded-[2rem] border-2 border-transparent hover:border-primary transition-all shadow-xl hover:shadow-2xl flex flex-col items-center space-y-4 animate-in zoom-in duration-500"
            >
              <div className="relative">
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-24 h-24 rounded-[1.5rem] object-cover ring-4 ring-muted group-hover:ring-primary/20 transition-all" 
                />
                <div className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground p-2 rounded-full shadow-lg group-hover:scale-110 transition-transform">
                  <PlayCircle className="w-5 h-5" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{user.name}</h3>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Active User</p>
              </div>
            </button>
          ))}

          <button
            onClick={createNewUser}
            className="bg-muted/30 p-6 rounded-[2rem] border-2 border-dashed border-muted-foreground/30 hover:border-accent hover:bg-accent/5 transition-all flex flex-col items-center justify-center space-y-4 animate-in zoom-in duration-700"
          >
            <div className="w-24 h-24 rounded-[1.5rem] bg-background border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
              <UserPlus className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg">Join the Mix</h3>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">New Profile</p>
            </div>
          </button>
        </div>

        <div className="pt-8">
          <Link href="/browse">
            <Button variant="ghost" className="text-primary font-bold gap-2 text-lg hover:bg-primary/5 px-8 rounded-full">
              <Users className="w-5 h-5" />
              See what others dropped
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}