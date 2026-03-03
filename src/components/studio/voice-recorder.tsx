"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Save, RotateCcw, Disc, Cross, PlusIcon, SidebarCloseIcon, Edit3Icon } from 'lucide-react';
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

  function createMediaRecorder(stream: MediaStream): MediaRecorder {
    const mediaRecorder = new MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder;

    return mediaRecorder
  }

  useEffect(() => {
    if (isRecording) {
      startRecording()
    }
    else {
      stopRecording()
    }

    // Cleanup function: Stops mic if component unmounts
    return () => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };


  }, [isRecording])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = createMediaRecorder(stream)
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioUrl(URL.createObjectURL(blob));
      };
      mediaRecorder.start();

    } catch (err) {
      mediaRecorderRef.current?.stop()
      toast({ title: "Microphone Access Denied", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {

      createMediaRecorder(mediaRecorderRef.current.stream).stop()
      // 1. Stop the recorder
      mediaRecorderRef.current.stop();

      // 2. Stop the microphone hardware (the tracks)
      mediaRecorderRef.current.stream.getTracks().forEach(track => {
        track.stop()
      })

      setIsRecording(false);
    }

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
    <div className="glass-panel rounded  py-4 flex flex-col gold-border">
      <div className="flex   w-full items-center  justify-between">
        <h3 className="  font-black flex items-center gap-2 italic tracking-tighter text-primary">
          <Mic className="w-5 h-5 border-b border-primary/60  " /> CAPTURE
        </h3>

        <div className=' flex gap-1  text-primary  ' >
         
          <input
            value={clipName}
            onChange={(e) => setClipName(e.target.value.toUpperCase())}
            placeholder="TRACK_NAME"
            className="text-[8px]  border-b font-black bg-transparent border-none focus:ring-0 text-right text-primary/90 outline-none tracking-[0.3em] uppercase"
          />
           <Edit3Icon size={11} />
        </div>

      </div>

      <div className="flex-1 flex flex-col w-full items-center justify-center bg-black/40 rounded-[2.5rem]  min-h-[250px] border border-primary/10 relative group overflow-hidden shadow-inner">
        {isRecording ? (
          <div className="flex w-full flex-col pb-10 items-center gap-8">
            <div className="w-[100] h-[100] flex-col rounded-full bg-red-500/10 border-4 border-red-500 flex items-center justify-center animate-pulse">
              <div onClick={stopRecording} className="w-12 h-12 cursor-pointer bg-red-500 rounded-xl" />
            </div>
            <p className="text-red-500  font-black text-xs uppercase tracking-[0.4em]">Signal Recording...</p>
          </div>
        ) : audioUrl ? (
          <div className="flex flex-col items-center gap-10 w-full animate-in fade-in zoom-in-95">
            <div className="w-full h-16 bg-neutral-900 rounded-3xl border border-white/5 flex items-center px-6">
              <audio src={audioUrl} controls className="w-full h-8 opacity-60 invert" />
            </div>
            <div className="flex gap-3 flex-wrap w-full">
              <Button variant="outline" className="flex-1 h-14 rounded-full font-black uppercase tracking-widest border-primary/20 bg-black/20" onClick={() =>{ setAudioUrl(null)
               setIsRecording(true)
              }}>
                <RotateCcw className="w-4 h-4 mr-2" /> Redo
              </Button>

              <Button className="flex-1 h-14 rounded-full font-black uppercase tracking-widest bg-primary text-black hover:bg-primary/90 shadow-xl" onClick={saveClip}>
                <Save className="w-4 h-4 mr-2" /> Commit
              </Button>

              <Button onClick={() => {
                setIsRecording(false)
                setAudioUrl(null);

              }} className="flex-1 h-14 rounded-full font-black uppercase tracking-widest bg-destructive text-black hover:bg-primary/90 shadow-xl" >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            className="w-[60] h-[60] rounded-lg bg-primary hover:bg-primary/90 text-black shadow-2xl transition-transform hover:scale-110 active:scale-95 gold-shadow"
            onClick={() => setIsRecording(true)}
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
        <div className="grid grid-cols-4 border-primary/30 border px-3 py-2 rounded-xl gap-2">
          {CHARACTER_TYPES.map((char) => {
            const Icon = char.icon;
            return (
              <button
                key={char.id}
                onClick={() => setSelectedChar(char.id)}
                className={cn(
                  "p-1 w-10 h-10 rounded-full border-2 transition-all flex flex-col items-center gap-2",
                  selectedChar === char.id
                    ? "border-primary/70 bg-primary/10 shadow-lg"
                    : "border-transparent bg-black/40 hover:bg-neutral-800"
                )}
              >
                <Icon className={cn("w-full h-full", char.color)} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}