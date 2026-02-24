"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileAudio, Save, Disc, Check } from 'lucide-react';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { db, User } from '@/lib/db';
import { toast } from '@/hooks/use-toast';

export function AudioUploader({ user, onClipSaved }: { user: User; onClipSaved: () => void }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedChar, setSelectedChar] = useState(CHARACTER_TYPES[1].id);
  const [clipName, setClipName] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setClipName(file.name.split('.')[0].toUpperCase());
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onloadend = () => {
      db.saveClip({
        id: crypto.randomUUID(),
        userId: user.id,
        name: clipName || 'EXTERNAL_SAMPLE',
        audioData: reader.result as string,
        characterType: selectedChar,
        createdAt: Date.now()
      });
      setSelectedFile(null);
      onClipSaved();
      toast({ title: "Sample Imported Successfully" });
    };
  };

  return (
    <div className="glass-panel rounded-[2.5rem] p-12 space-y-10 flex flex-col gold-border">
      <h3 className="text-3xl font-black flex items-center gap-4 italic tracking-tighter text-primary">
        <Upload className="w-7 h-7" /> IMPORT
      </h3>

      <div className="flex-1 flex flex-col items-center justify-center p-12 border-2 border-dashed border-primary/20 rounded-[2.5rem] bg-black/40 relative cursor-pointer hover:bg-primary/5 transition-all group overflow-hidden shadow-inner">
        <input 
          type="file" 
          accept="audio/*" 
          className="absolute inset-0 opacity-0 cursor-pointer z-10" 
          onChange={handleFileChange}
        />
        {selectedFile ? (
          <div className="text-center space-y-6 animate-in zoom-in-95">
            <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto gold-border">
              <FileAudio className="w-12 h-12 text-primary animate-bounce-subtle" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] truncate max-w-[240px] text-primary">{selectedFile.name}</p>
              <p className="text-[10px] font-black uppercase text-muted-foreground mt-1 tracking-widest">WAV / MP3 READY</p>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <Disc className="w-20 h-20 text-white/5 mx-auto group-hover:text-primary/30 group-hover:rotate-180 transition-all duration-1000" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground group-hover:text-white transition-colors">DRAG_SOUND_ASSET</p>
              <p className="text-[10px] font-black uppercase text-muted-foreground/30 mt-2 tracking-widest">Local Filesystem</p>
            </div>
          </div>
        )}
      </div>

      {selectedFile ? (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] px-2">Identification</label>
              <input 
                value={clipName}
                onChange={(e) => setClipName(e.target.value.toUpperCase())}
                placeholder="SAMPLE_NAME"
                className="w-full text-center text-xs font-black bg-neutral-900 border border-primary/20 rounded-2xl py-4 focus:outline-none focus:border-primary text-primary tracking-[0.4em]"
              />
           </div>
          <div className="space-y-5">
            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] px-2">Assign Visualizer</label>
            <div className="grid grid-cols-4 gap-4">
              {CHARACTER_TYPES.map((char) => {
                const Icon = char.icon;
                return (
                  <button
                    key={char.id}
                    onClick={() => setSelectedChar(char.id)}
                    className={cn(
                      "p-5 rounded-3xl border-2 transition-all flex flex-col items-center justify-center",
                      selectedChar === char.id 
                        ? "border-primary bg-primary/10 shadow-lg" 
                        : "border-transparent bg-black/40 hover:bg-neutral-800"
                    )}
                  >
                    <Icon className={cn("w-9 h-9", char.color)} />
                  </button>
                );
              })}
            </div>
          </div>
          <Button className="w-full h-16 rounded-full bg-primary text-black font-black uppercase tracking-[0.3em] hover:bg-primary/90 shadow-2xl scale-105" onClick={handleUpload}>
            <Save className="w-5 h-5 mr-3" /> Commit Import
          </Button>
        </div>
      ) : (
        <div className="h-[280px] flex items-center justify-center border border-white/5 rounded-[2.5rem] opacity-20 pointer-events-none">
           <p className="text-[10px] font-black uppercase tracking-[0.5em]">Awaiting Selection</p>
        </div>
      )}
    </div>
  );
}