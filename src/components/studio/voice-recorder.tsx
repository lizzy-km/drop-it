
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Save, RotateCcw } from 'lucide-react';
import { CHARACTER_TYPES } from '@/components/character-icons';
import { cn } from '@/lib/utils';
import { db, User } from '@/lib/db';
import { toast } from '@/hooks/use-toast';

interface VoiceRecorderProps {
  user: User;
  onClipSaved: () => void;
}

export function VoiceRecorder({ user, onClipSaved }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedChar, setSelectedChar] = useState(CHARACTER_TYPES[0].id);
  const [clipName, setClipName] = useState('New Beat');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
      toast({ title: "Microphone Access Denied", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const saveClip = async () => {
    if (!audioUrl) return;

    const response = await fetch(audioUrl);
    const blob = await response.blob();
    
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      
      db.saveClip({
        id: crypto.randomUUID(),
        userId: user.id,
        name: clipName,
        audioData: base64data,
        characterType: selectedChar,
        createdAt: Date.now()
      });

      setAudioUrl(null);
      setClipName('New Beat');
      onClipSaved();
      toast({ title: "Clip saved!" });
    };
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Mic className="w-5 h-5 text-accent" /> Record Sound
        </h3>
        <input 
          value={clipName}
          onChange={(e) => setClipName(e.target.value)}
          placeholder="Clip name..."
          className="text-sm border-none focus:ring-0 text-right font-medium text-primary"
        />
      </div>

      <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-xl min-h-[160px] relative">
        {isRecording ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-500 animate-pulse flex items-center justify-center">
              <div className="w-8 h-8 bg-white rounded-sm" />
            </div>
            <p className="text-red-500 font-medium animate-pulse">Recording...</p>
          </div>
        ) : audioUrl ? (
          <div className="flex flex-col items-center gap-4">
            <audio src={audioUrl} controls className="w-full max-w-xs" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAudioUrl(null)}>
                <RotateCcw className="w-4 h-4 mr-2" /> Discard
              </Button>
              <Button size="sm" onClick={saveClip}>
                <Save className="w-4 h-4 mr-2" /> Save Clip
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            size="lg" 
            className="w-20 h-20 rounded-full bg-primary hover:bg-primary/90"
            onClick={startRecording}
          >
            <Mic className="w-8 h-8" />
          </Button>
        )}
        
        {isRecording && (
          <Button 
            variant="destructive" 
            className="mt-4"
            onClick={stopRecording}
          >
            <Square className="w-4 h-4 mr-2" /> Stop Recording
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground">Pick a character</label>
        <div className="grid grid-cols-4 gap-3">
          {CHARACTER_TYPES.map((char) => {
            const Icon = char.icon;
            return (
              <button
                key={char.id}
                onClick={() => setSelectedChar(char.id)}
                className={cn(
                  "p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1",
                  selectedChar === char.id 
                    ? "border-primary bg-primary/5 shadow-sm" 
                    : "border-transparent bg-muted/50 hover:bg-muted"
                )}
              >
                <Icon className={cn("w-8 h-8", char.color)} />
                <span className="text-[10px] capitalize font-medium">{char.id}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
