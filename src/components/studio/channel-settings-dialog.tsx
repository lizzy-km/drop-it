
"use client";

import React from 'react';
import { 
  Play, Maximize2, Waves, Timer, Sparkles, Sliders, Zap, 
  Waveform, Music, Box, Settings2, Trash2, Library, Wand2,
  Activity, Radio, ZapOff, Layers, Power
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChannelSettings } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { VisualEnvelope, VisualFilterCurve, VisualLFO } from './visualizers';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

interface ChannelSettingsDialogProps {
  channelIdx: number;
  settings: ChannelSettings;
  onUpdate: (key: keyof ChannelSettings, val: any) => void;
  onAudition: () => void;
}

const PRESETS: Record<string, Partial<ChannelSettings>> = {
  PUNCHY_KICK: {
    ampAttack: 0.01, ampDecay: 0.1, ampSustain: 0, ampRelease: 0.05,
    svfCut: 0.1, svfEmph: 0.2, svfType: 'lowpass', limiterPre: 1.2,
    svfActive: true, ampActive: true, fxActive: true
  },
  VAPOR_CHORD: {
    ampAttack: 1.2, ampDecay: 0.8, ampSustain: 0.7, ampRelease: 1.5,
    svfCut: 0.4, svfEmph: 0.6, svfType: 'bandpass', lfoRate: 0.3, oscLfo: 0.2,
    svfActive: true, ampActive: true, lfoActive: true
  },
  INDUSTRIAL_HIT: {
    distortion: 0.8, ampRelease: 0.1, svfCut: 0.8, svfEmph: 0.9, limiterPre: 1.5,
    fxActive: true, svfActive: true
  }
};

export function ChannelSettingsDialog({ channelIdx, settings: s, onUpdate, onAudition }: ChannelSettingsDialogProps) {
  const applyPreset = (preset: Partial<ChannelSettings>) => {
    Object.entries(preset).forEach(([key, val]) => {
      onUpdate(key as keyof ChannelSettings, val);
    });
    toast({ title: "Signal Profile Applied" });
  };

  const SectionHeader = ({ title, icon: Icon, activeKey, description }: { title: string, icon: any, activeKey: keyof ChannelSettings, description: string }) => (
    <div className="flex items-center justify-between mb-8">
      <div className="flex flex-col">
        <h4 className="text-[11px] font-black uppercase text-primary tracking-[0.4em] flex items-center gap-3">
          <Icon className="w-4 h-4" /> {title}
        </h4>
        <span className="text-[9px] font-black text-muted-foreground uppercase mt-1">{description}</span>
      </div>
      <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
        <span className={cn("text-[8px] font-black uppercase tracking-widest", s[activeKey] ? "text-primary" : "text-muted-foreground")}>
          {s[activeKey] ? 'ACTIVE' : 'BYPASS'}
        </span>
        <Switch 
          checked={!!s[activeKey]} 
          onCheckedChange={(checked) => onUpdate(activeKey, checked)}
          className="data-[state=checked]:bg-primary"
        />
      </div>
    </div>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-primary/40 hover:text-black">
          <Sliders className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl glass-panel border-primary/20 rounded-[3rem] p-12 gold-shadow">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-4xl font-black italic text-primary tracking-tighter uppercase flex items-center gap-4">
              <Box className="w-8 h-8" /> SAMPLER_LAB
            </DialogTitle>
            <div className="flex items-center gap-6">
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
              <div className="px-5 py-2 rounded-full bg-black/40 border border-primary/10 text-[10px] font-black text-primary/40 uppercase tracking-[0.3em]">
                Channel_{channelIdx}
              </div>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="osc" className="mt-8">
          <TabsList className="bg-black/40 p-2 rounded-2xl mb-8 flex justify-start gap-2 border border-white/5 h-auto">
            {['osc', 'amp', 'svf', 'lfo', 'fx'].map((tab) => (
              <TabsTrigger 
                key={tab} 
                value={tab} 
                className={cn(
                  "rounded-xl font-black text-[10px] uppercase tracking-widest py-3 px-6 data-[state=active]:bg-primary data-[state=active]:text-black flex items-center gap-2",
                  !s[`${tab}Active` as keyof ChannelSettings] && "opacity-50"
                )}
              >
                {tab === 'fx' ? 'FX/LMT' : tab.toUpperCase()}
                {!s[`${tab}Active` as keyof ChannelSettings] && <Power className="w-3 h-3 text-red-500" />}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-[55vh] overflow-y-auto pr-4 custom-scrollbar">
            <div className="md:col-span-8">
              {/* OSC CONTENT */}
              <TabsContent value="osc" className="mt-0 space-y-8 animate-in fade-in slide-in-from-left-4">
                 <div className={cn("bg-black/40 p-10 rounded-[2.5rem] border border-white/5 space-y-10 transition-opacity", !s.oscActive && "opacity-30")}>
                    <SectionHeader title="OSCILLATOR_SOURCE" icon={Radio} activeKey="oscActive" description="Sample_Playback_Engine" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                       <div className="space-y-6">
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Coarse_Tune (Semi)</Label>
                             <Slider disabled={!s.oscActive} value={[s.oscCoarse]} min={-24} max={24} step={1} onValueChange={(v) => onUpdate('oscCoarse', v[0])} />
                             <div className="text-[10px] font-black text-primary text-right">{s.oscCoarse > 0 ? `+${s.oscCoarse}` : s.oscCoarse} ST</div>
                          </div>
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Fine_Tune (Cents)</Label>
                             <Slider disabled={!s.oscActive} value={[s.oscFine]} min={-100} max={100} step={1} onValueChange={(v) => onUpdate('oscFine', v[0])} />
                             <div className="text-[10px] font-black text-primary text-right">{s.oscFine > 0 ? `+${s.oscFine}` : s.oscFine} C</div>
                          </div>
                       </div>
                       <div className="space-y-8">
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">PW / Phase_Width</Label>
                             <Slider disabled={!s.oscActive} value={[s.oscPw * 100]} onValueChange={(v) => onUpdate('oscPw', v[0] / 100)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">LFO_Mod</Label>
                                <Slider disabled={!s.oscActive} value={[s.oscLfo * 100]} onValueChange={(v) => onUpdate('oscLfo', v[0] / 100)} />
                             </div>
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Env_Mod</Label>
                                <Slider disabled={!s.oscActive} value={[s.oscEnv * 100]} onValueChange={(v) => onUpdate('oscEnv', v[0] / 100)} />
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </TabsContent>

              {/* AMP CONTENT */}
              <TabsContent value="amp" className="mt-0 space-y-8 animate-in fade-in slide-in-from-left-4">
                <div className={cn("bg-black/40 p-10 rounded-[2.5rem] border border-white/5 space-y-10 transition-opacity", !s.ampActive && "opacity-30")}>
                   <SectionHeader title="AMPLIFIER_AHDSR" icon={Waves} activeKey="ampActive" description="Output_Gain_Envelope" />
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
                      {['Attack', 'Decay', 'Sustain', 'Release'].map((stage) => {
                        const key = `amp${stage}` as keyof ChannelSettings;
                        const val = (s as any)[key] || 0;
                        return (
                          <div key={stage} className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{stage}</Label>
                              <span className="text-[10px] font-black text-primary">{val.toFixed(2)}s</span>
                            </div>
                            <Slider 
                              disabled={!s.ampActive}
                              value={[val * 100]} 
                              max={stage === 'Sustain' ? 100 : 300} 
                              onValueChange={(v) => onUpdate(key, v[0] / 100)} 
                            />
                          </div>
                        );
                      })}
                   </div>
                   
                   <div className="pt-8 border-t border-white/5">
                    {s.ampActive && <VisualEnvelope attack={s.ampAttack} release={s.ampRelease} />}
                   </div>
                </div>
              </TabsContent>

              {/* SVF CONTENT */}
              <TabsContent value="svf" className="mt-0 space-y-8 animate-in fade-in slide-in-from-left-4">
                 <div className={cn("bg-black/40 p-10 rounded-[2.5rem] border border-white/5 space-y-10 transition-opacity", !s.svfActive && "opacity-30")}>
                    <SectionHeader title="STATE_VARIABLE_FILTER" icon={Activity} activeKey="svfActive" description="Acoustic_Sculpting" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                       <div className="space-y-8">
                          {s.svfActive && <VisualFilterCurve cutoff={s.svfCut} resonance={s.svfEmph} type={s.svfType} />}
                          <div className="grid grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cutoff</Label>
                                <Slider disabled={!s.svfActive} value={[s.svfCut * 100]} onValueChange={(v) => onUpdate('svfCut', v[0] / 100)} />
                             </div>
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Emph (Res)</Label>
                                <Slider disabled={!s.svfActive} value={[s.svfEmph * 100]} onValueChange={(v) => onUpdate('svfEmph', v[0] / 100)} />
                             </div>
                          </div>
                       </div>
                       <div className="space-y-6">
                          <div className="flex gap-2 mb-4">
                            {['lowpass', 'highpass', 'bandpass'].map(type => (
                               <Button 
                                 key={type} 
                                 disabled={!s.svfActive}
                                 variant="outline" 
                                 size="sm" 
                                 className={cn("h-8 text-[8px] font-black uppercase rounded-lg border-primary/20", s.svfType === type ? "bg-primary text-black" : "bg-black/40 text-primary/40")}
                                 onClick={() => onUpdate('svfType', type)}
                               >
                                 {type.slice(0, 4)}
                               </Button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Env_Depth</Label>
                                <Slider disabled={!s.svfActive} value={[s.svfEnv * 100]} onValueChange={(v) => onUpdate('svfEnv', v[0] / 100)} />
                             </div>
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">KB_Tracking</Label>
                                <Slider disabled={!s.svfActive} value={[s.svfKb * 100]} onValueChange={(v) => onUpdate('svfKb', v[0] / 100)} />
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </TabsContent>

              {/* LFO CONTENT */}
              <TabsContent value="lfo" className="mt-0 space-y-8 animate-in fade-in slide-in-from-left-4">
                 <div className={cn("bg-black/40 p-10 rounded-[2.5rem] border border-white/5 space-y-10 transition-opacity", !s.lfoActive && "opacity-30")}>
                    <SectionHeader title="MODULATION_LFO" icon={Zap} activeKey="lfoActive" description="Low_Frequency_Modulator" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                       <div className="space-y-8">
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Rate (Freq)</Label>
                             <Slider disabled={!s.lfoActive} value={[s.lfoRate * 100]} max={2000} onValueChange={(v) => onUpdate('lfoRate', v[0] / 100)} />
                             <div className="text-[10px] font-black text-primary text-right">{(s.lfoRate * 10).toFixed(1)} Hz</div>
                          </div>
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Delay (Fade)</Label>
                             <Slider disabled={!s.lfoActive} value={[s.lfoDelay * 100]} onValueChange={(v) => onUpdate('lfoDelay', v[0] / 100)} />
                          </div>
                       </div>
                       <div className="bg-white/5 p-8 rounded-3xl border border-white/5 space-y-4">
                          <Label className="text-[9px] font-black uppercase tracking-widest text-primary">Routing_Matrix</Label>
                          {s.lfoActive && <VisualLFO rate={s.lfoRate} delay={s.lfoDelay} />}
                       </div>
                    </div>
                 </div>
              </TabsContent>

              {/* FX/LIMITER CONTENT */}
              <TabsContent value="fx" className="mt-0 space-y-8 animate-in fade-in slide-in-from-left-4">
                 <div className={cn("bg-black/40 p-10 rounded-[2.5rem] border border-white/5 grid grid-cols-2 gap-12 transition-opacity", !s.fxActive && "opacity-30")}>
                    <div className="space-y-8">
                       <SectionHeader title="FX_CHAIN" icon={Layers} activeKey="fxActive" description="Harmonic_Saturation" />
                       <div className="space-y-6">
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Unison_Spread</Label>
                             <Slider disabled={!s.fxActive} value={[s.unison * 100]} onValueChange={(v) => onUpdate('unison', v[0] / 100)} />
                          </div>
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Harmonic_Dist</Label>
                             <Slider disabled={!s.fxActive} value={[s.distortion * 100]} onValueChange={(v) => onUpdate('distortion', v[0] / 100)} />
                          </div>
                       </div>
                    </div>
                    <div className="space-y-8 border-l border-white/5 pl-12">
                       <h4 className="text-[11px] font-black uppercase text-primary tracking-[0.4em] flex items-center gap-3">
                         <ZapOff className="w-4 h-4" /> MASTER_LIMITER
                       </h4>
                       <div className="space-y-6">
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pre_Gain</Label>
                             <Slider disabled={!s.fxActive} value={[s.limiterPre * 100]} max={200} onValueChange={(v) => onUpdate('limiterPre', v[0] / 100)} />
                          </div>
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mix</Label>
                             <Slider disabled={!s.fxActive} value={[s.limiterMix * 100]} onValueChange={(v) => onUpdate('limiterMix', v[0] / 100)} />
                          </div>
                       </div>
                    </div>
                 </div>
              </TabsContent>
            </div>

            {/* SIDEBAR MONITOR */}
            <div className="md:col-span-4 space-y-8">
               <div className="glass-panel p-8 rounded-[2.5rem] space-y-8 bg-black/60 gold-border">
                  <div className="flex items-center gap-3 text-primary">
                    <Settings2 className="w-5 h-5" />
                    <span className="font-black text-[10px] tracking-[0.3em] uppercase">SIGNAL_MONITOR</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex justify-between items-center">
                       <span className="text-[9px] font-black text-muted-foreground uppercase">Output_Level</span>
                       <span className="text-[10px] font-black text-primary">{Math.round(s.volume * 100)}%</span>
                    </div>
                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex justify-between items-center">
                       <span className="text-[9px] font-black text-muted-foreground uppercase">Sample_Rate</span>
                       <span className="text-[10px] font-black text-primary">44.1 KHZ</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full h-20 rounded-[2rem] bg-primary text-black font-black uppercase tracking-[0.4em] text-xs hover:bg-primary/90 shadow-2xl transition-all hover:scale-[1.02] active:scale-95"
                    onClick={onAudition}
                  >
                    <Play className="w-6 h-6 mr-4 fill-current" /> AUDITION_SIGNAL
                  </Button>
               </div>
               
               <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
                  <p className="text-[9px] font-bold text-muted-foreground/60 leading-relaxed uppercase tracking-widest">
                    Adjusting these parameters modulates the internal Web Audio node graph. Inactive (bypassed) modules do not consume additional processing overhead.
                  </p>
               </div>
            </div>
          </div>
        </Tabs>
        
        <DialogFooter className="pt-8 border-t border-white/10 mt-4">
          <Button 
            className="w-full h-14 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-primary hover:text-black transition-all"
            onClick={() => toast({ title: "Signal Committed to Studio" })}
          >
            Apply_Acoustic_Model
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
