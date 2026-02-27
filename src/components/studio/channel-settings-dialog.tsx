
"use client";

import React, { useState, useEffect } from 'react';
import { 
  Play, Maximize2, Waves, Timer, Sparkles, Sliders, Zap, 
  Waveform, Music, Box, Settings2, Trash2, Library, Wand2,
  Activity, Radio, ZapOff, Layers, Power, Save, Plus,
  FileDown, FileUp, Download, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChannelSettings, db, Preset } from '@/lib/db';
import { toast } from '@/hooks/use-toast';
import { VisualEnvelope, VisualFilterCurve, VisualLFO } from './visualizers';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface ChannelSettingsDialogProps {
  channelIdx: number;
  settings: ChannelSettings;
  onUpdate: (key: keyof ChannelSettings, val: any) => void;
  onBatchUpdate: (settings: Partial<ChannelSettings>) => void;
  onAudition: () => void;
}

const FACTORY_PRESETS: Record<string, Partial<ChannelSettings>> = {
  PUNCHY_KICK: {
    ampAttack: 0.01, ampDecay: 0.1, ampSustain: 0, ampRelease: 0.05,
    svfCut: 0.1, svfEmph: 0.2, svfType: 'lowpass', limiterPre: 1.2,
    svfActive: true, ampActive: true, fxActive: true, oscActive: true,
    volume: 0.9, pitch: 1.0
  },
  VAPOR_CHORD: {
    ampAttack: 1.2, ampDecay: 0.8, ampSustain: 0.7, ampRelease: 1.5,
    svfCut: 0.4, svfEmph: 0.6, svfType: 'bandpass', lfoRate: 0.3, oscLfo: 0.2,
    svfActive: true, ampActive: true, lfoActive: true, oscActive: true,
    volume: 0.7
  },
  INDUSTRIAL_HIT: {
    distortion: 0.8, ampRelease: 0.1, svfCut: 0.8, svfEmph: 0.9, limiterPre: 1.5,
    fxActive: true, svfActive: true, oscActive: true, volume: 1.0
  }
};

export function ChannelSettingsDialog({ channelIdx, settings: s, onUpdate, onBatchUpdate, onAudition }: ChannelSettingsDialogProps) {
  const [userPresets, setUserPresets] = useState<Preset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  useEffect(() => {
    setUserPresets(db.getPresets());
  }, []);

  const applyPreset = (presetSettings: Partial<ChannelSettings>) => {
    // Sanitize values to prevent NaN issues
    const sanitized: Partial<ChannelSettings> = {};
    Object.keys(presetSettings).forEach(key => {
      const val = (presetSettings as any)[key];
      if (typeof val === 'number') {
        sanitized[key as keyof ChannelSettings] = isNaN(val) ? 0 : val;
      } else {
        sanitized[key as keyof ChannelSettings] = val;
      }
    });
    onBatchUpdate(sanitized);
    toast({ title: "Signal Profile Applied" });
  };

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      toast({ title: "Identification Required", description: "Name your signal profile before saving.", variant: "destructive" });
      return;
    }
    const newPreset: Preset = {
      id: crypto.randomUUID(),
      name: newPresetName.toUpperCase(),
      settings: { ...s }
    };
    db.savePreset(newPreset);
    setUserPresets(db.getPresets());
    setNewPresetName('');
    setShowSaveInput(false);
    toast({ title: "Preset Saved to Library" });
  };

  const handleExportPresetFile = () => {
    try {
      // Create a clean copy of settings for export
      const sanitizedSettings = { ...s };
      
      const data = {
        type: "DROPIT_PRESET",
        version: "1.0",
        name: newPresetName || `CHANNEL_${channelIdx}_CONFIG`,
        settings: sanitizedSettings
      };
      
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const fileName = `${(newPresetName || `preset_ch_${channelIdx}`).toLowerCase().replace(/\s+/g, '_')}.json`;
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 0);
      
      toast({ title: "Config Exported to Disk", description: `Saved as ${fileName}` });
    } catch (err) {
      console.error("Export Error:", err);
      toast({ title: "Export Failed", variant: "destructive" });
    }
  };

  const handleImportPresetFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.type !== "DROPIT_PRESET") {
           // Try to fallback if it looks like a raw settings object
           if (data.volume !== undefined || data.oscActive !== undefined) {
             applyPreset(data);
             toast({ title: "Raw Config Loaded" });
             return;
           }
           throw new Error("Invalid Format");
        }
        applyPreset(data.settings);
        toast({ title: "Disk Config Loaded", description: data.name || "Unnamed Preset" });
      } catch (err) {
        console.error("Import Error:", err);
        toast({ title: "Import Error", description: "Unsupported config schema.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const deleteUserPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    db.deletePreset(id);
    setUserPresets(db.getPresets());
    toast({ title: "Preset Deleted" });
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
            <div className="flex items-center gap-4">
               {showSaveInput ? (
                 <div className="flex items-center gap-2 animate-in slide-in-from-right-4">
                    <Input 
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value.toUpperCase())}
                      placeholder="PRESET_NAME"
                      className="bg-black/40 border-primary/20 h-12 w-48 text-[10px] font-black uppercase tracking-widest text-primary"
                    />
                    <div className="flex gap-1">
                      <Button onClick={handleSavePreset} className="bg-primary text-black h-12 rounded-xl font-black uppercase text-[10px] tracking-widest px-4">
                        <Save className="w-3.5 h-3.5 mr-2" /> Save
                      </Button>
                      <Button onClick={handleExportPresetFile} variant="outline" className="border-primary/20 bg-black/40 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest px-4 text-primary">
                        <FileDown className="w-3.5 h-3.5 mr-2" /> Export
                      </Button>
                    </div>
                    <Button variant="ghost" onClick={() => setShowSaveInput(false)} className="text-muted-foreground h-12">
                      Cancel
                    </Button>
                 </div>
               ) : (
                 <div className="flex items-center gap-2">
                    <Button onClick={() => setShowSaveInput(true)} variant="outline" className="rounded-xl border-primary/20 bg-black/40 text-[10px] font-black uppercase tracking-widest text-primary h-12 px-6">
                      <Save className="w-4 h-4 mr-2" /> Preset_Lab
                    </Button>
                    <div className="relative">
                      <input type="file" accept=".json" onChange={handleImportPresetFile} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                      <Button variant="outline" className="rounded-xl border-primary/20 bg-black/40 text-[10px] font-black uppercase tracking-widest text-primary h-12 px-6">
                        <FileUp className="w-4 h-4 mr-2" /> Load_Config
                      </Button>
                    </div>
                 </div>
               )}

               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl border-primary/20 bg-black/40 text-[10px] font-black uppercase tracking-widest text-primary h-12 px-6">
                    <Library className="w-4 h-4 mr-2" /> Preset_Library
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="glass-panel border-primary/20 rounded-2xl min-w-[240px] max-h-[400px] overflow-y-auto">
                  <div className="px-4 py-2 text-[8px] font-black text-muted-foreground uppercase tracking-widest">Factory_Standards</div>
                  {Object.keys(FACTORY_PRESETS).map(name => (
                    <DropdownMenuItem 
                      key={name} 
                      className="focus:bg-primary/10 rounded-xl cursor-pointer font-black text-[9px] uppercase tracking-widest p-4"
                      onClick={() => applyPreset(FACTORY_PRESETS[name])}
                    >
                      {name}
                    </DropdownMenuItem>
                  ))}
                  
                  {userPresets.length > 0 && (
                    <>
                      <DropdownMenuSeparator className="bg-white/10" />
                      <div className="px-4 py-2 text-[8px] font-black text-primary uppercase tracking-widest">User_Library</div>
                      {userPresets.map(p => (
                        <DropdownMenuItem 
                          key={p.id} 
                          className="focus:bg-primary/10 rounded-xl cursor-pointer font-black text-[9px] uppercase tracking-widest p-4 flex justify-between group/item"
                          onClick={() => applyPreset(p.settings)}
                        >
                          <span>{p.name}</span>
                          <Trash2 
                            className="w-3.5 h-3.5 text-red-500 opacity-0 group-hover/item:opacity-100 transition-opacity" 
                            onClick={(e) => deleteUserPreset(p.id, e)}
                          />
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="px-5 py-2 rounded-full bg-black/40 border border-primary/10 text-[10px] font-black text-primary/40 uppercase tracking-[0.3em]">
                CH_{channelIdx}
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
                {tab === 'fx' ? 'FX_LMT' : tab.toUpperCase()}
                {!s[`${tab}Active` as keyof ChannelSettings] && <ZapOff className="w-3 h-3 text-red-500" />}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-[55vh] overflow-y-auto pr-4 custom-scrollbar">
            <div className="md:col-span-8">
              <TabsContent value="osc" className="mt-0 space-y-8 animate-in fade-in slide-in-from-left-4">
                 <div className={cn("bg-black/40 p-10 rounded-[2.5rem] border border-white/5 space-y-10 transition-opacity", !s.oscActive && "opacity-30")}>
                    <SectionHeader title="OSCILLATOR_SOURCE" icon={Radio} activeKey="oscActive" description="Sample_Engine" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                       <div className="space-y-6">
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Coarse_Tune</Label>
                             <Slider disabled={!s.oscActive} value={[s.oscCoarse || 0]} min={-24} max={24} step={1} onValueChange={(v) => onUpdate('oscCoarse', v[0])} />
                             <div className="text-[10px] font-black text-primary text-right">{((s.oscCoarse || 0) > 0) ? `+${s.oscCoarse}` : (s.oscCoarse || 0)} ST</div>
                          </div>
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Fine_Tune</Label>
                             <Slider disabled={!s.oscActive} value={[s.oscFine || 0]} min={-100} max={100} step={1} onValueChange={(v) => onUpdate('oscFine', v[0])} />
                             <div className="text-[10px] font-black text-primary text-right">{((s.oscFine || 0) > 0) ? `+${s.oscFine}` : (s.oscFine || 0)} C</div>
                          </div>
                       </div>
                       <div className="space-y-8">
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Phase_Width</Label>
                             <Slider disabled={!s.oscActive} value={[(s.oscPw || 0) * 100]} onValueChange={(v) => onUpdate('oscPw', v[0] / 100)} />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">LFO_Mod</Label>
                                <Slider disabled={!s.oscActive} value={[(s.oscLfo || 0) * 100]} onValueChange={(v) => onUpdate('oscLfo', v[0] / 100)} />
                             </div>
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Env_Mod</Label>
                                <Slider disabled={!s.oscActive} value={[(s.oscEnv || 0) * 100]} onValueChange={(v) => onUpdate('oscEnv', v[0] / 100)} />
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="amp" className="mt-0 space-y-8 animate-in fade-in slide-in-from-left-4">
                <div className={cn("bg-black/40 p-10 rounded-[2.5rem] border border-white/5 space-y-10 transition-opacity", !s.ampActive && "opacity-30")}>
                   <SectionHeader title="AMPLIFIER_AHDSR" icon={Waves} activeKey="ampActive" description="Output_Envelope" />
                   
                   <div className="grid grid-cols-1 gap-8">
                      {['Attack', 'Decay', 'Sustain', 'Release'].map((stage) => {
                        const key = `amp${stage}` as keyof ChannelSettings;
                        const val = (s as any)[key] || 0;
                        return (
                          <div key={stage} className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{stage}</Label>
                              <span className="text-[10px] font-black text-primary">{(val || 0).toFixed(2)}s</span>
                            </div>
                            <Slider 
                              disabled={!s.ampActive}
                              value={[(val || 0) * 100]} 
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

              <TabsContent value="svf" className="mt-0 space-y-8 animate-in fade-in slide-in-from-left-4">
                 <div className={cn("bg-black/40 p-10 rounded-[2.5rem] border border-white/5 space-y-10 transition-opacity", !s.svfActive && "opacity-30")}>
                    <SectionHeader title="STATE_VARIABLE_FILTER" icon={Activity} activeKey="svfActive" description="Acoustic_Model" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                       <div className="space-y-8">
                          {s.svfActive && <VisualFilterCurve cutoff={s.svfCut} resonance={s.svfEmph} type={s.svfType} />}
                          <div className="grid grid-cols-2 gap-8">
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cutoff</Label>
                                <Slider disabled={!s.svfActive} value={[(s.svfCut || 1) * 100]} onValueChange={(v) => onUpdate('svfCut', v[0] / 100)} />
                             </div>
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Resonance</Label>
                                <Slider disabled={!s.svfActive} value={[(s.svfEmph || 0.2) * 100]} onValueChange={(v) => onUpdate('svfEmph', v[0] / 100)} />
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
                                <Slider disabled={!s.svfActive} value={[(s.svfEnv || 0) * 100]} onValueChange={(v) => onUpdate('svfEnv', v[0] / 100)} />
                             </div>
                             <div className="space-y-4">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">KB_Track</Label>
                                <Slider disabled={!s.svfActive} value={[(s.svfKb || 0) * 100]} onValueChange={(v) => onUpdate('svfKb', v[0] / 100)} />
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="lfo" className="mt-0 space-y-8 animate-in fade-in slide-in-from-left-4">
                 <div className={cn("bg-black/40 p-10 rounded-[2.5rem] border border-white/5 space-y-10 transition-opacity", !s.lfoActive && "opacity-30")}>
                    <SectionHeader title="MODULATION_LFO" icon={Zap} activeKey="lfoActive" description="Signal_Mod" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-12">
                       <div className="space-y-8">
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Rate</Label>
                             <Slider disabled={!s.lfoActive} value={[(s.lfoRate || 1) * 100]} max={2000} onValueChange={(v) => onUpdate('lfoRate', v[0] / 100)} />
                             <div className="text-[10px] font-black text-primary text-right">{((s.lfoRate || 1) * 10).toFixed(1)} Hz</div>
                          </div>
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Delay</Label>
                             <Slider disabled={!s.lfoActive} value={[(s.lfoDelay || 0) * 100]} onValueChange={(v) => onUpdate('lfoDelay', v[0] / 100)} />
                          </div>
                       </div>
                       <div className="bg-white/5 p-8 rounded-3xl border border-white/5">
                          <Label className="text-[8px] font-black uppercase tracking-[0.3em] text-primary/40 block mb-4">WAVEFORM_MONITOR</Label>
                          {s.lfoActive && <VisualLFO rate={s.lfoRate} delay={s.lfoDelay} />}
                       </div>
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="fx" className="mt-0 space-y-8 animate-in fade-in slide-in-from-left-4">
                 <div className={cn("bg-black/40 p-10 rounded-[2.5rem] border border-white/5 grid grid-cols-2 gap-12 transition-opacity", !s.fxActive && "opacity-30")}>
                    <div className="space-y-8">
                       <SectionHeader title="FX_CHAIN" icon={Layers} activeKey="fxActive" description="Harmonic_Chain" />
                       <div className="space-y-6">
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Unison_Spread</Label>
                             <Slider disabled={!s.fxActive} value={[(s.unison || 0) * 100]} onValueChange={(v) => onUpdate('unison', v[0] / 100)} />
                          </div>
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Distortion</Label>
                             <Slider disabled={!s.fxActive} value={[(s.distortion || 0) * 100]} onValueChange={(v) => onUpdate('distortion', v[0] / 100)} />
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
                             <Slider disabled={!s.fxActive} value={[(s.limiterPre || 1) * 100]} max={200} onValueChange={(v) => onUpdate('limiterPre', v[0] / 100)} />
                          </div>
                          <div className="space-y-4">
                             <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mix</Label>
                             <Slider disabled={!s.fxActive} value={[(s.limiterMix || 0) * 100]} onValueChange={(v) => onUpdate('limiterMix', v[0] / 100)} />
                          </div>
                       </div>
                    </div>
                 </div>
              </TabsContent>
            </div>

            <div className="md:col-span-4 space-y-8">
               <div className="glass-panel p-8 rounded-[2.5rem] space-y-8 bg-black/60 gold-border">
                  <div className="flex items-center gap-3 text-primary">
                    <Settings2 className="w-5 h-5" />
                    <span className="font-black text-[10px] tracking-[0.3em] uppercase">MONITORING</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex justify-between items-center">
                       <span className="text-[9px] font-black text-muted-foreground uppercase">Out_Level</span>
                       <span className="text-[10px] font-black text-primary">{Math.round((s.volume || 0.8) * 100)}%</span>
                    </div>
                    <div className="bg-black/40 p-5 rounded-2xl border border-white/5 flex justify-between items-center">
                       <span className="text-[9px] font-black text-muted-foreground uppercase">Engine_Clock</span>
                       <span className="text-[10px] font-black text-primary">44.1 KHZ</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full h-20 rounded-[2rem] bg-primary text-black font-black uppercase tracking-[0.4em] text-xs hover:bg-primary/90 shadow-2xl transition-all hover:scale-[1.02] active:scale-95"
                    onClick={onAudition}
                  >
                    <Play className="w-6 h-6 mr-4 fill-current" /> AUDITION
                  </Button>
               </div>
               
               <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5">
                  <p className="text-[9px] font-bold text-muted-foreground/40 leading-relaxed uppercase tracking-widest">
                    Acoustic parameters are modulated via Web Audio nodes. Bypass inactive modules to reduce studio overhead.
                  </p>
               </div>
            </div>
          </div>
        </Tabs>
        
        <DialogFooter className="pt-8 border-t border-white/10 mt-4">
          <Button 
            className="w-full h-14 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-primary hover:text-black transition-all"
            onClick={() => toast({ title: "Signal Committed" })}
          >
            Apply_Signal_Chain
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
