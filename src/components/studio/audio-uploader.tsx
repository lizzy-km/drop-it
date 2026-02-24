"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileAudio, Save } from 'lucide-react';
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
      setClipName(file.name.split('.')[0]);
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
        name: clipName || 'Uploaded Sound',
        audioData: reader.result as string,
        characterType: selectedChar,
        createdAt: Date.now()
      });
      
      setSelectedFile(null);
      setClipName('');
      onClipSaved();
      toast({ title: "File uploaded!" });
    };
  };

  return (
    <div className="bg-card rounded-2xl p-6 shadow-sm border space-y-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Upload className="w-5 h-5 text-accent" /> Upload Audio
      </h3>

      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted rounded-xl bg-muted/10 relative cursor-pointer hover:bg-muted/20 transition-colors">
        <input 
          type="file" 
          accept="audio/*" 
          className="absolute inset-0 opacity-0 cursor-pointer" 
          onChange={handleFileChange}
        />
        {selectedFile ? (
          <div className="text-center">
            <FileAudio className="w-10 h-10 text-primary mx-auto mb-2" />
            <p className="text-sm font-medium text-primary max-w-[200px] truncate">{selectedFile.name}</p>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-medium">Click to pick audio file</p>
            <p className="text-xs text-muted-foreground/60 mt-1">MP3, WAV, etc.</p>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="space-y-4 pt-2">
           <input 
            value={clipName}
            onChange={(e) => setClipName(e.target.value)}
            placeholder="Name your clip"
            className="w-full text-sm bg-transparent border-b border-border py-1 focus:outline-none focus:border-primary text-foreground"
          />
          <div className="grid grid-cols-4 gap-2">
            {CHARACTER_TYPES.map((char) => {
              const Icon = char.icon;
              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedChar(char.id)}
                  className={cn(
                    "p-2 rounded-lg border transition-all",
                    selectedChar === char.id ? "border-primary bg-primary/10" : "border-transparent bg-muted/50"
                  )}
                >
                  <Icon className={cn("w-6 h-6 mx-auto", char.color)} />
                </button>
              );
            })}
          </div>
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleUpload}>
            <Save className="w-4 h-4 mr-2" /> Save Uploaded Clip
          </Button>
        </div>
      )}
    </div>
  );
}