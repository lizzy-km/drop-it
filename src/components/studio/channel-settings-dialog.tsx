
"use client";

import React from 'react';
import { 
  Play, Maximize2, Waves, Timer, Sparkles, ArrowRightLeft, Sliders, Zap, 
  Waveform, Music, Box, Settings2, Trash2, Library, Wand2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChannelSettings } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { VisualEnvelope, VisualTrim } from './visualizers';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ChannelSettingsDialogProps {
  channelIdx: number;
  settings: ChannelSettings;
  onUpdate: (key: keyof ChannelSettings, val: any) => void;
  onAudition: () => void;
}

const PRESETS: Record<string, Partial<ChannelSettings>> = {
  PUNCHY_KICK: {
    volAttack: 0.01, volHold: 0.05, volDecay: 0.2, volSustain: 0, volRelease: 0.05,
    cutoff: 0.1, distortion: 0.3, limiterPre: 0.8
  },
  SMOOTH_PAD: {
    volAttack: 1.5, volHold: 0.5, volDecay: 1.0, volSustain: 0.8, volRelease: 2.0,
    cutoff: 0.4, reverb: 0.8, unison: 0.5
  },
  INDUSTRIAL_SNARE: {
    volAttack: 0, volHold: 0, volDecay: 0.1, volSustain: 0.1, volRelease: 0.2,
    distortion: 0.8, filterSeq: 0.6, limiterPre: 1.0
  },
  CHILL_VIBE: {
    vibrato: 0.4, cutoff: 0.5, pan: -0.2, delay: 0.4, volRelease: 1.0
  }
};

export function ChannelSettingsDialog({ channelIdx, settings: s, onUpdate, onAudition }: ChannelSettingsDialogProps) {
  const applyPreset = (preset: Partial<ChannelSettings>) => {
    Object.entries(preset).forEach(([key, val]) => {
      onUpdate(key as keyof ChannelSettings, val);
    });
    toast({ title: "Acoustic Preset Applied" });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary/40 hover:text-black">
          <Sliders className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl glass-panel border-primary/20 rounded-[3rem] p-12 gold-shadow">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-4xl font-black italic text-primary tracking-tighter uppercase flex items-center gap-4">
              <Maximize2 className="w-8 h-8" /> Sampler_Lab
            </DialogTitle>
            <div className="flex items-center gap-4">
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl border-primary/20 bg-black/40 text-[10px] font-black uppercase tracking-widest text-primary h-12 px-6">
                    <Wand2 className="w-4 h-4 mr-2" /> Load_Preset
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="glass-panel border-primary/20 rounded-2xl min-w-[200px]">
                  {Object.keys(PRESETS).map(name => (
                    <DropdownMenuItem 
                      key={name} 
                      className="focus:bg-primary/10 rounded-xl cursor-pointer font-black text-[9px] uppercase tracking-widest p-4"
                      onClick={() => applyPreset(PRESETS[name])}
                    >
                      {name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-[10px] tracking-[0.4em] font-black text-primary/40">Channel_{channelIdx}</span>
            </div>
          </div>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-10 max-h-[70vh] overflow-y-scroll pr-4 custom-scrollbar">
          {/* Volume AHDSR */}
          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative group">
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
              <Timer className="w-4 h-4" /> Volume_AHDSR
            </h4>
            <VisualEnvelope attack={s.volAttack} release={s.volRelease} />
            <div className="space-y-4">
              {['Attack', 'Hold', 'Decay', 'Sustain', 'Release'].map((stage) => {
                const key = `vol${stage}` as keyof ChannelSettings;
                const val = (s as any)[key] || 0;
                return (
                  <div key={stage} className="space-y-2">
                    <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                      <span>{stage}</span>
                      <span className="text-primary">{val.toFixed(2)}s</span>
                    </div>
                    <Slider value={[val * 100]} max={stage === 'Sustain' ? 100 : 200} onValueChange={(v) => onUpdate(key, v[0] / 100)} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter AHDSR & Harmonics */}
          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative group">
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Filter_&_Harmonics
            </h4>
            <div className="space-y-6">
              <div className="space-y-3">
                 <Label className="text-[9px] font-black uppercase text-muted-foreground">Cutoff / Distortion</Label>
                 <Slider value={[s.cutoff * 100]} onValueChange={(v) => onUpdate('cutoff', v[0] / 100)} />
                 <Slider value={[s.distortion * 100]} onValueChange={(v) => onUpdate('distortion', v[0] / 100)} />
              </div>
              <div className="pt-4 border-t border-white/5 space-y-4">
                <Label className="text-[9px] font-black uppercase text-primary">Filter_Envelope</Label>
                {['Attack', 'Decay', 'Sustain'].map((stage) => {
                  const key = `filter${stage}` as keyof ChannelSettings;
                  const val = (s as any)[key] || 0;
                  return (
                    <div key={stage} className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                        <span>{stage}</span>
                        <span className="text-primary">{val.toFixed(2)}</span>
                      </div>
                      <Slider value={[val * 100]} max={200} onValueChange={(v) => onUpdate(key, v[0] / 100)} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Effects & Limiter */}
          <div className="space-y-8 bg-black/40 p-8 rounded-[3rem] border border-white/5 relative group">
            <h4 className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
              <Zap className="w-4 h-4" /> FX_Neural_Chain
            </h4>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                  <span>Vibrato / Unison</span>
                </div>
                <Slider value={[s.vibrato * 100]} onValueChange={(v) => onUpdate('vibrato', v[0] / 100)} />
                <Slider value={[s.unison * 100]} onValueChange={(v) => onUpdate('unison', v[0] / 100)} />
              </div>
              <div className="space-y-4 pt-4 border-t border-white/5">
                <Label className="text-[9px] font-black uppercase text-primary">Master_Limiter</Label>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                    <span>Pre_Gain</span>
                    <span className="text-primary">{Math.round(s.limiterPre * 100)}%</span>
                  </div>
                  <Slider value={[s.limiterPre * 100]} max={200} onValueChange={(v) => onUpdate('limiterPre', v[0] / 100)} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-black uppercase text-muted-foreground">
                    <span>Mix</span>
                    <span className="text-primary">{Math.round(s.limiterMix * 100)}%</span>
                  </div>
                  <Slider value={[s.limiterMix * 100]} onValueChange={(v) => onUpdate('limiterMix', v[0] / 100)} />
                </div>
              </div>
              
              <Button 
                className="w-full h-16 rounded-2xl bg-primary text-black font-black uppercase tracking-[0.3em] hover:bg-primary/90 shadow-2xl transition-all"
                onClick={onAudition}
              >
                <Play className="w-5 h-5 mr-3 fill-current" /> Audition
              </Button>
            </div>
          </div>
        </div>
        
        <DialogFooter className="pt-8 border-t border-white/5">
          <Button 
            className="w-full h-14 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-primary hover:text-black transition-all"
            onClick={() => toast({ title: "Signal Committed to Studio" })}
          >
            Apply_Neural_Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
