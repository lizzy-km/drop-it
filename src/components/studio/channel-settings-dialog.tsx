"use client";

import React from 'react';
import { 
  Play, Maximize2, Waves, Timer, Sparkles, ArrowRightLeft, Sliders
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChannelSettings } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { VisualEnvelope, VisualTrim } from './visualizers';

interface ChannelSettingsDialogProps {
  channelIdx: number;
  settings: ChannelSettings;
  onUpdate: (key: keyof ChannelSettings, val: any) => void;
  onAudition: () => void;
}

export function ChannelSettingsDialog({ channelIdx, settings: s, onUpdate, onAudition }: ChannelSettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary/40 hover:text-black">
          <Sliders className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl glass-panel border-primary/20 rounded-[3rem] p-12 gold-shadow">
        <DialogHeader>
          <DialogTitle className="text-4xl font-black italic text-primary tracking-tighter uppercase flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Maximize2 className="w-8 h-8" /> Sampler_Lab
            </div>
            <span className="text-[10px] tracking-[0.4em] font-black text-primary/40">Channel_{channelIdx}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 py-10 max-h-[60vh] overflow-y-scroll pr-4 custom-scrollbar">
          {/* Signal Modifiers */}
          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative group">
            <div className="absolute top-0 right-0 p-4">
              <Waves className="w-4 h-4 text-primary/10 group-hover:text-primary/40 transition-colors" />
            </div>
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Signal_Modifiers</h4>
              <div className="flex items-center gap-3">
                <Label className="text-[9px] font-black uppercase">Reverse</Label>
                <Switch checked={s.reversed} onCheckedChange={(v) => onUpdate('reversed', v)} />
              </div>
            </div>
            <VisualTrim start={s.trimStart} end={s.trimEnd} />
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Trim_Start</span>
                  <span className="text-primary">{Math.round(s.trimStart * 100)}%</span>
                </div>
                <Slider value={[s.trimStart * 100]} onValueChange={(v) => onUpdate('trimStart', v[0] / 100)} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Trim_End</span>
                  <span className="text-primary">{Math.round(s.trimEnd * 100)}%</span>
                </div>
                <Slider value={[s.trimEnd * 100]} onValueChange={(v) => onUpdate('trimEnd', v[0] / 100)} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Auto_Tune</span>
                  <span className="text-primary">{Math.round(s.autoTune * 100)}%</span>
                </div>
                <Slider value={[s.autoTune * 100]} onValueChange={(v) => onUpdate('autoTune', v[0] / 100)} />
              </div>
            </div>
          </div>

          {/* Envelope Dynamics */}
          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative group">
            <div className="absolute top-0 right-0 p-4">
              <Timer className="w-4 h-4 text-primary/10 group-hover:text-primary/40 transition-colors" />
            </div>
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Envelope_Dynamics</h4>
            <VisualEnvelope attack={s.attack} release={s.release} />
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Attack</span>
                  <span className="text-primary">{s.attack.toFixed(2)}s</span>
                </div>
                <Slider value={[s.attack * 100]} max={200} onValueChange={(v) => onUpdate('attack', v[0] / 100)} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Release</span>
                  <span className="text-primary">{s.release.toFixed(2)}s</span>
                </div>
                <Slider value={[s.release * 100]} max={200} onValueChange={(v) => onUpdate('release', v[0] / 100)} />
              </div>
            </div>
          </div>

          {/* Harmonics */}
          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative group">
            <div className="absolute top-0 right-0 p-4">
              <Sparkles className="w-4 h-4 text-primary/10 group-hover:text-primary/40 transition-colors" />
            </div>
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Harmonics</h4>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Pitch</span>
                  <span className="text-primary">{s.pitch.toFixed(2)}x</span>
                </div>
                <Slider value={[s.pitch * 50]} min={25} max={200} onValueChange={(v) => onUpdate('pitch', v[0] / 50)} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Cutoff</span>
                  <span className="text-primary">{Math.round(s.cutoff * 100)}%</span>
                </div>
                <Slider value={[s.cutoff * 100]} onValueChange={(v) => onUpdate('cutoff', v[0] / 100)} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Distortion</span>
                  <span className="text-primary">{Math.round(s.distortion * 100)}%</span>
                </div>
                <Slider value={[s.distortion * 100]} onValueChange={(v) => onUpdate('distortion', v[0] / 100)} />
              </div>
            </div>
          </div>

          {/* Spatial Field */}
          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative group">
            <div className="absolute top-0 right-0 p-4">
              <ArrowRightLeft className="w-4 h-4 text-primary/10 group-hover:text-primary/40 transition-colors" />
            </div>
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">Spatial_Field</h4>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Panning</span>
                  <span className="text-primary">{s.pan.toFixed(2)}</span>
                </div>
                <Slider value={[s.pan * 50 + 50]} min={0} max={100} onValueChange={(v) => onUpdate('pan', (v[0] - 50) / 50)} />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Delay_Send</span>
                  <span className="text-primary">{Math.round(s.delay * 100)}%</span>
                </div>
                <Slider value={[s.delay * 100]} onValueChange={(v) => onUpdate('delay', v[0] / 100)} />
              </div>
              <div className="pt-6">
                <Button 
                  className="w-full h-20 rounded-[1.5rem] bg-primary text-black font-black uppercase tracking-[0.3em] hover:bg-primary/90 shadow-2xl transition-all"
                  onClick={onAudition}
                >
                  <Play className="w-6 h-6 mr-3 fill-current" /> Audition_Signal
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="pt-8 border-t border-white/5">
          <Button 
            className="w-full h-14 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-primary hover:text-black transition-all"
            onClick={() => toast({ title: "Neural Synchronization Complete" })}
          >
            Commit_Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
