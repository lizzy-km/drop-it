"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Save, RotateCcw, Disc } from 'lucide-react';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { db, User } from '@/lib/db';
import { toast } from '@/hooks/use-toast';

export function VoiceRecorder({ user, onClipSaved }: { user: User; onClipSaved: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedChar, setSelectedChar] = useState(CHARACTER_TYPES[0].id);
  const [clipName, setClipName] = useState('New Vocal');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioUrl(URL.createObjectURL(blob));
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      toast({ title: "Microphone Error", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const saveClip = async () => {
    if (!audioUrl) return;
    const res = await fetch(audioUrl);
    const blob = await res.blob();
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      db.saveClip({
        id: crypto.randomUUID(),
        userId: user.id,
        name: clipName,
        audioData: reader.result as string,
        characterType: selectedChar,
        createdAt: Date.now()
      });
      setAudioUrl(null);
      onClipSaved();
      toast({ title: "Vocal Captured" });
    };
  };

  return (
    <div className="glass-panel rounded-[2.5rem] p-10 border-white/5 space-y-8 flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-black flex items-center gap-3 italic">
          <Mic className="w-6 h-6 text-primary" /> RECORD
        </h3>
        <input 
          value={clipName}
          onChange={(e) => setClipName(e.target.value)}
          placeholder="TRACK_NAME"
          className="text-xs font-black bg-transparent border-none focus:ring-0 text-right text-primary outline-none tracking-widest uppercase"
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-white/5 rounded-3xl p-10 min-h-[200px] border border-white/5 relative group overflow-hidden">
        {isRecording ? (
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center animate-pulse">
              <div className="w-10 h-10 bg-red-500 rounded-lg" />
            </div>
            <p className="text-red-500 font-black text-xs uppercase tracking-[0.3em]">Recording Audio...</p>
          </div>
        ) : audioUrl ? (
          <div className="flex flex-col items-center gap-8 w-full">
            <audio src={audioUrl} controls className="w-full max-w-xs h-10 opacity-50" />
            <div className="flex gap-4">
              <Button variant="outline" size="lg" onClick={() => setAudioUrl(null)} className="rounded-full px-8 font-black uppercase tracking-widest border-white/10">
                <RotateCcw className="w-4 h-4 mr-2" /> Redo
              </Button>
              <Button size="lg" onClick={saveClip} className="rounded-full px-8 font-black uppercase tracking-widest bg-primary text-black">
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            size="lg" 
            className="w-24 h-24 rounded-full bg-primary hover:bg-primary/90 text-black shadow-2xl transition-transform hover:scale-110 active:scale-95"
            onClick={startRecording}
          >
            <Mic className="w-10 h-10" />
          </Button>
        )}
        
        {isRecording && (
          <Button variant="destructive" className="absolute bottom-4 rounded-full px-6 font-black uppercase text-[10px]" onClick={stopRecording}>
            Stop Signal
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Assign Avatar Type</label>
        <div className="grid grid-cols-4 gap-4">
          {CHARACTER_TYPES.map((char) => {
            const Icon = char.icon;
            return (
              <button
                key={char.id}
                onClick={() => setSelectedChar(char.id)}
                className={cn(
                  "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                  selectedChar === char.id 
                    ? "border-primary bg-primary/10 shadow-lg" 
                    : "border-transparent bg-white/5 hover:bg-white/10"
                )}
              >
                <Icon className={cn("w-10 h-10", char.color)} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}