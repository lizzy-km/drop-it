"use client";

import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';

export const VisualEnvelope = ({ attack, release }: { attack: number, release: number }) => {
  const a = (attack / 2) * 100;
  const r = (release / 2) * 100;
  
  return (
    <div className="h-32 w-full bg-black/60 rounded-[0] border border-primary/10 overflow-hidden relative shadow-inner">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="env-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path 
          d={`M 0 100 L ${a} 0 L ${100 - r} 0 L 100 100 Z`}
          fill="url(#env-grad)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          className="transition-all duration-500 ease-out"
        />
        <circle cx={a} cy="0" r="2" fill="white" className="animate-pulse" />
        <circle cx={100 - r} cy="0" r="2" fill="white" className="animate-pulse" />
      </svg>
      <div className="absolute bottom-2 left-4 text-[8px] font-black uppercase text-primary/40 tracking-widest">Envelope_A/R</div>
    </div>
  );
};

export const VisualTrim = ({ start, end }: { start: number, end: number }) => {
  return (
    <div className="h-24 w-full bg-black/60 rounded-[0] border border-primary/10 overflow-hidden relative shadow-inner group">
      <div className="absolute inset-0 opacity-20 flex items-center justify-around pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-0.5 bg-primary" style={{ height: `${20 + Math.random() * 60}%` }} />
        ))}
      </div>
      <div 
        className="absolute h-full bg-primary/20 border-x border-primary/60 transition-all duration-300"
        style={{ left: `${start * 100}%`, right: `${(1 - end) * 100}%` }}
      >
        <div className="absolute inset-0 studio-grid-bg opacity-30" />
      </div>
      <div className="absolute bottom-2 left-4 text-[8px] font-black uppercase text-primary/40 tracking-widest">Trim_Slice</div>
    </div>
  );
};

export const MasterVisualizer = ({ analyser }: { analyser: AnalyserNode | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      let maxVal = 0;
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxVal) maxVal = dataArray[i];
        barHeight = (dataArray[i] / 255) * canvas.height;
        
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, 'rgba(250, 204, 21, 0.1)');
        gradient.addColorStop(1, 'rgba(250, 204, 21, 0.8)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      const peakPercent = maxVal / 255;
      ctx.fillStyle = peakPercent > 0.9 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(250, 204, 21, 0.4)';
      ctx.fillRect(canvas.width - 20, canvas.height * (1 - peakPercent), 10, canvas.height * peakPercent);
    };

    draw();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [analyser]);

  return (
    <div className="  w-full bg-black/40 rounded-[1rem] overflow-hidden border border-primary/10 relative shadow-inner">
      <canvas ref={canvasRef} width={800} height={100} className="w-full h-full" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <Activity className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
};
