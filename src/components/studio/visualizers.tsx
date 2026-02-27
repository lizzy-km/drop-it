
"use client";

import React, { useEffect, useRef } from 'react';
import { Activity, Waves, Zap } from 'lucide-react';

export const VisualEnvelope = ({ attack, release }: { attack?: number, release?: number }) => {
  const att = attack ?? 0.01;
  const rel = release ?? 0.1;
  const a = (att / 3) * 100;
  const r = (rel / 3) * 100;
  
  return (
    <div className="h-24 w-40 bg-black/60 rounded-xl border border-primary/10 overflow-hidden relative shadow-inner">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <path 
          d={`M 0 100 L ${Math.max(0, a)} 0 L ${Math.min(100, 100 - r)} 0 L 100 100 Z`}
          fill="rgba(250, 204, 21, 0.2)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute bottom-1 left-2 text-[6px] font-black uppercase text-primary/40 tracking-widest">AHDSR_ENV</div>
    </div>
  );
};

export const VisualFilterCurve = ({ cutoff, resonance, type }: { cutoff?: number, resonance?: number, type?: string }) => {
  const cut = cutoff ?? 1;
  const resVal = resonance ?? 0.2;
  const t = type ?? 'lowpass';
  
  const c = cut * 100;
  const res = resVal * 40;
  
  let d = '';
  if (t === 'lowpass') {
    d = `M 0 100 L ${Math.max(0, c - 10)} 100 Q ${c} ${100 - res} ${Math.min(100, c + 20)} 100`;
  } else if (t === 'highpass') {
    d = `M 100 100 L ${Math.min(100, c + 10)} 100 Q ${c} ${100 - res} ${Math.max(0, c - 20)} 100`;
  } else {
    d = `M 0 100 L ${Math.max(0, c - 20)} 100 Q ${c} ${100 - res} ${Math.min(100, c + 20)} 100 L 100 100`;
  }

  return (
    <div className="h-32 w-full bg-black/60 rounded-[2rem] border border-primary/10 overflow-hidden relative">
      <div className="absolute inset-0 opacity-10 studio-grid-bg" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <path 
          d={d}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          className="transition-all duration-300"
        />
        <circle cx={isNaN(c) ? 50 : c} cy={isNaN(100 - (res / 2)) ? 50 : 100 - (res / 2)} r="2" fill="white" className="animate-pulse" />
      </svg>
      <div className="absolute top-2 left-4 text-[7px] font-black uppercase text-primary/40 tracking-widest">SVF_RESPONSE</div>
    </div>
  );
};

export const VisualLFO = ({ rate, delay }: { rate?: number, delay?: number }) => {
  const rVal = rate ?? 1;
  const [time, setTime] = React.useState(0);

  useEffect(() => {
    let frame: number;
    const animate = () => {
      setTime(prev => prev + 1);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const points = [];
  for (let x = 0; x <= 100; x += 2) {
    const y = 50 + Math.sin((x + (time / 2)) * rVal * 0.5) * 30;
    points.push(`${x},${y}`);
  }

  return (
    <div className="h-20 w-40 bg-black/60 rounded-xl border border-primary/10 overflow-hidden relative">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
        <polyline 
          points={points.join(' ')}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
        />
      </svg>
      <div className="absolute bottom-1 left-2 text-[6px] font-black uppercase text-primary/40 tracking-widest">LFO_WAVE</div>
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

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(250, 204, 21, ${0.1 + (dataArray[i] / 255) * 0.8})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [analyser]);

  return (
    <div className="w-full bg-black/40 rounded-[1rem] overflow-hidden border border-primary/10 relative shadow-inner">
      <canvas ref={canvasRef} width={800} height={100} className="w-full h-full" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <Activity className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
};
