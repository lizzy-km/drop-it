
"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { NoteProperty } from '@/lib/db';

interface GraphEditorProps {
  channelIdx: number;
  numSteps: number;
  grid: Record<string, NoteProperty[]>;
  onUpdate: (stepIdx: number, value: number) => void;
  property: 'velocity' | 'finePitch';
}

export function GraphEditor({ channelIdx, numSteps, grid, onUpdate, property }: GraphEditorProps) {
  return (
    <div className="flex gap-1 items-end h-full w-full px-2">
      {Array.from({ length: numSteps }).map((_, stepIdx) => {
        const key = `${channelIdx}-${stepIdx}`;
        const notes = grid[key] || [];
        const value = notes[0]?.[property] || 0;
        
        // Normalize for display
        const displayValue = property === 'velocity' ? value : (value + 100) / 200;

        return (
          <div key={stepIdx} className="flex-1 h-full flex flex-col justify-end group/bar relative">
            <div 
              className={cn(
                "w-full rounded-t-[1px] transition-all cursor-ns-resize daw-button-outer", 
                notes.length > 0 ? "bg-primary/50 group-hover/bar:bg-primary" : "bg-white/5"
              )}
              style={{ height: `${displayValue * 100}%` }}
              onMouseDown={(e) => {
                const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                if (!rect) return;
                const handleMouseMove = (moveEvent: MouseEvent) => {
                   const newVal = Math.max(0, Math.min(1, 1 - (moveEvent.clientY - rect.top) / rect.height));
                   const finalVal = property === 'velocity' ? newVal : (newVal * 200) - 100;
                   onUpdate(stepIdx, finalVal);
                };
                const handleMouseUp = () => {
                  window.removeEventListener('mousemove', handleMouseMove);
                  window.removeEventListener('mouseup', handleMouseUp);
                };
                window.addEventListener('mousemove', handleMouseMove);
                window.addEventListener('mouseup', handleMouseUp);
              }}
            />
            {stepIdx % 4 === 0 && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-white/10" />}
          </div>
        );
      })}
    </div>
  );
}
