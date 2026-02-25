
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function Logo({ className, size = 40, showText = false }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-4 group", className)}>
      <div 
        className="relative flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        {/* Outer Glow / Pulse */}
        <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:bg-primary/40 transition-all duration-700 animate-pulse" />
        
        {/* Main Logo Body */}
        <div className="relative w-full h-full bg-black rounded-2xl border border-primary/30 flex items-center justify-center overflow-hidden gold-shadow">
          <svg 
            viewBox="0 0 40 40" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="w-[70%] h-[70%] text-primary"
          >
            {/* The "Drop" Silhouette formed by equalizer bars */}
            <rect x="18" y="8" width="4" height="24" rx="2" fill="currentColor" className="animate-bounce-subtle" style={{ animationDelay: '0s' }} />
            <rect x="12" y="14" width="4" height="12" rx="2" fill="currentColor" className="animate-bounce-subtle" style={{ animationDelay: '0.2s' }} />
            <rect x="24" y="14" width="4" height="12" rx="2" fill="currentColor" className="animate-bounce-subtle" style={{ animationDelay: '0.4s' }} />
            <rect x="6" y="18" width="4" height="6" rx="2" fill="currentColor" className="animate-bounce-subtle" style={{ animationDelay: '0.6s' }} />
            <rect x="30" y="18" width="4" height="6" rx="2" fill="currentColor" className="animate-bounce-subtle" style={{ animationDelay: '0.8s' }} />
            
            {/* The Base Circle */}
            <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="opacity-20" />
          </svg>
        </div>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span className="text-3xl font-black italic tracking-tighter leading-none text-white uppercase group-hover:text-primary transition-colors">
            DROP <span className="text-primary">IT.</span>
          </span>
          <span className="text-[8px] font-black tracking-[0.6em] text-muted-foreground uppercase mt-1">Acoustic_Neural_Engine</span>
        </div>
      )}
    </div>
  );
}
