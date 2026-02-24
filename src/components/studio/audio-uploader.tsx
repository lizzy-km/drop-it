"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileAudio, Save, Disc } from 'lucide-react';
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
        name: clipName || 'IMPORTED_SAMPLE',
        audioData: reader.result as string,
        characterType: selectedChar,
        createdAt: Date.now()
      });
      setSelectedFile(null);
      onClipSaved();
      toast({ title: "Sample Imported" });
    };
  };

  return (
    <div className="glass-panel rounded-[2.5rem] p-10 border-white/5 space-y-8 flex flex-col">
      <h3 className="text-2xl font-black flex items-center gap-3 italic">
        <Upload className="w-6 h-6 text-primary" /> IMPORT
      </h3>

      <div className="flex-1 flex flex-col items-center justify-center p-10 border-2 border-dashed border-white/5 rounded-3xl bg-white/5 relative cursor-pointer hover:bg-white/10 transition-all group overflow-hidden">
        <input 
          type="file" 
          accept="audio/*" 
          className="absolute inset-0 opacity-0 cursor-pointer" 
          onChange={handleFileChange}
        />
        {selectedFile ? (
          <div className="text-center space-y-4">
            <FileAudio className="w-16 h-16 text-primary mx-auto animate-bounce-subtle" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest truncate max-w-[200px]">{selectedFile.name}</p>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Ready to process</p>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <Disc className="w-16 h-16 text-white/10 mx-auto group-hover:text-primary/50 group-hover:rotate-180 transition-all duration-1000" />
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-muted-foreground group-hover:text-white transition-colors">Drop WAV/MP3 Here</p>
              <p className="text-[10px] font-black uppercase text-muted-foreground/40 mt-1">Local file system</p>
            </div>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
           <input 
            value={clipName}
            onChange={(e) => setClipName(e.target.value.toUpperCase())}
            placeholder="SAMPLE_NAME"
            className="w-full text-center text-xs font-black bg-transparent border-b border-white/10 py-2 focus:outline-none focus:border-primary text-primary tracking-widest"
          />
          <div className="grid grid-cols-4 gap-4">
            {CHARACTER_TYPES.map((char) => {
              const Icon = char.icon;
              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedChar(char.id)}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all",
                    selectedChar === char.id ? "border-primary bg-primary/10 shadow-lg" : "border-transparent bg-white/5 hover:bg-white/10"
                  )}
                >
                  <Icon className={cn("w-10 h-10 mx-auto", char.color)} />
                </button>
              );
            })}
          </div>
          <Button className="w-full h-14 rounded-full bg-primary text-black font-black uppercase tracking-widest hover:bg-primary/90 shadow-2xl" onClick={handleUpload}>
            <Save className="w-4 h-4 mr-3" /> Commit Import
          </Button>
        </div>
      )}
    </div>
  );
}