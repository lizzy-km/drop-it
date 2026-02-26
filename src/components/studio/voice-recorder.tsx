"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Save, RotateCcw, Disc, Cross } from 'lucide-react';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { db, User } from '@/lib/db';
import { toast } from '@/hooks/use-toast';

export function VoiceRecorder({ user, onClipSaved }: { user: User; onClipSaved: () => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedChar, setSelectedChar] = useState(CHARACTER_TYPES[0].id);
  const [clipName, setClipName] = useState('NEW_VOCAL');
  
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
      toast({ title: "Microphone Access Denied", variant: "destructive" });
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
        name: clipName || 'VOCAL_CLIP',
        audioData: reader.result as string,
        characterType: selectedChar,
        createdAt: Date.now()
      });
      setAudioUrl(null);
      onClipSaved();
      toast({ title: "Vocal Asset Created" });
    };
  };

  return (
    <div className="glass-panel rounded-[2.5rem] p-12 space-y-10 flex flex-col gold-border">
      <div className="flex items-center justify-between">
        <h3 className="text-3xl font-black flex items-center gap-4 italic tracking-tighter text-primary">
          <Mic className="w-7 h-7  " /> CAPTURE
        </h3>
        <input 
          value={clipName}
          onChange={(e) => setClipName(e.target.value.toUpperCase())}
          placeholder="TRACK_NAME"
          className="text-xs font-black bg-transparent border-none focus:ring-0 text-right text-primary outline-none tracking-[0.3em] uppercase"
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-black/40 rounded-[2.5rem] p-12 min-h-[250px] border border-primary/10 relative group overflow-hidden shadow-inner">
        {isRecording ? (
          <div  className="flex flex-col items-center gap-8">
            <div className="w-28 h-28 rounded-full bg-red-500/10 border-4 border-red-500 flex items-center justify-center animate-pulse">
              <div onClick={stopRecording} className="w-12 h-12 cursor-pointer bg-red-500 rounded-xl" />
            </div>
            <p className="text-red-500 font-black text-xs uppercase tracking-[0.4em]">Signal Recording...</p>
          </div>
        ) : audioUrl ? (
          <div className="flex flex-col items-center gap-10 w-full animate-in fade-in zoom-in-95">
            <div className="w-full h-16 bg-neutral-900 rounded-3xl border border-white/5 flex items-center px-6">
               <audio src={audioUrl} controls className="w-full h-8 opacity-60 invert" />
            </div>
            <div className="flex gap-3 flex-wrap w-full">
              <Button variant="outline" className="flex-1 h-14 rounded-full font-black uppercase tracking-widest border-primary/20 bg-black/20" onClick={() => setAudioUrl(null)}>
                <RotateCcw className="w-4 h-4 mr-2" /> Redo
              </Button>

              <Button className="flex-1 h-14 rounded-full font-black uppercase tracking-widest bg-primary text-black hover:bg-primary/90 shadow-xl" onClick={saveClip}>
                <Save className="w-4 h-4 mr-2" /> Commit
              </Button>
              
               <Button className="flex-1 h-14 rounded-full font-black uppercase tracking-widest bg-destructive text-black hover:bg-primary/90 shadow-xl" onClick={saveClip}>
                <Cross className="w-4 h-4 mr-2" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            className="w-28 h-28 rounded-[2.5rem] bg-primary hover:bg-primary/90 text-black shadow-2xl transition-transform hover:scale-110 active:scale-95 gold-shadow"
            onClick={startRecording}
          >
            <Mic className="w-12 h-12" />
          </Button>
        )}
        
        {isRecording && (
          <Button variant="destructive" className="absolute bottom-6 rounded-full px-10 h-10 font-black uppercase text-[10px] tracking-widest" onClick={stopRecording}>
            Cut Signal
          </Button>
        )}
      </div>

      <div className="space-y-5">
        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] px-2">Assigned Visualizer</label>
        <div className="grid grid-cols-4 gap-4">
          {CHARACTER_TYPES.map((char) => {
            const Icon = char.icon;
            return (
              <button
                key={char.id}
                onClick={() => setSelectedChar(char.id)}
                className={cn(
                  "p-5 rounded-3xl border-2 transition-all flex flex-col items-center gap-2",
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
    </div>
  );
}