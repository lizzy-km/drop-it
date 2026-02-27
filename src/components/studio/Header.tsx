import { Dices, Download, DownloadCloud, Edit2Icon, Loader2, Play, Save, Square, Upload, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { MasterVisualizer } from "./visualizers";
import { Slider } from "../ui/slider";
import { cn } from "@/lib/utils";
import { AudioClip, db, Track } from "@/lib/db";
import { toast } from "@/hooks/use-toast";

const MAX_STEPS = 64;

export default function StudioHeader(props: { setNumSteps: (val: number) => void; setBpm: (val: number) => void; setIsPlaying: (val: boolean) => void; isPlaying: boolean; bpm: number; numSteps: number, track?: Track, setGrid: (grid: Record<string, string[]>) => void, masterAnalyserRef: React.MutableRefObject<AnalyserNode | null>, clips: AudioClip[], selectedClipsForChannel: Record<string, string>, user: any, channelSettings: Record<string, any>, onSaveTrack: (track: Track) => void, onImportRefresh?: () => void, grid: Record<string, string[]>; playClip: (clipId: string, channelId: string, timeOffset: number, offlineCtx: OfflineAudioContext) => Promise<void>; audioBufferToWav: (buffer: AudioBuffer) => Blob, numChannels: number }) {

    const { setNumSteps, setBpm, setIsPlaying, isPlaying, bpm, numSteps, track, setGrid, masterAnalyserRef, clips, selectedClipsForChannel, user, channelSettings, onSaveTrack, onImportRefresh, grid, playClip, audioBufferToWav, numChannels } = props;

    const [isExporting, setIsExporting] = useState(false);

    const [numStepsInput, setNumStepsInput] = useState((track?.numSteps || 16).toString());

    const [bpmInput, setBpmInput] = useState((track?.bpm || 120).toString());
    const [title, setTitle] = useState(track?.title || 'NEW_PROJECT_01');


    const randomizePattern = () => {
        const activeChannels = Object.keys(selectedClipsForChannel).filter(ch => !!selectedClipsForChannel[ch]);
        if (activeChannels.length === 0) {
            toast({ title: "No Tracks Assigned", description: "Assign sound clips to tracks before generating patterns.", variant: "destructive" });
            return;
        }

        const newGrid: Record<string, string[]> = { ...grid };
        activeChannels.forEach(ch => {
            const clipId = selectedClipsForChannel[ch];
            for (let s = 0; s < numSteps; s++) {
                if (Math.random() > 0.85) {
                    newGrid[`${ch}-${s}`] = [clipId];
                } else {
                    const key = `${ch}-${s}`;
                    if (newGrid[key]) {
                        newGrid[key] = newGrid[key].filter(id => id !== clipId);
                        if (newGrid[key].length === 0) delete newGrid[key];
                    }
                }
            }
        });
        setGrid && setGrid(newGrid);
        toast({ title: "Pattern Generated", description: `Rhythms manifested on ${activeChannels.length} active tracks.` });
    };

    const handleSave = () => {
        const newTrack: Track = {
            id: track?.id || crypto.randomUUID(),
            userId: user.id,
            title,
            bpm,
            numChannels,
            numSteps,
            grid,
            channelSettings,
            selectedClips: selectedClipsForChannel,
            createdAt: Date.now()
        };
        db.saveTrack(newTrack);
        onSaveTrack(newTrack);
        toast({ title: "Session Committed" });
    };

    const handleExportConfig = () => {
        const currentTrack: Track = {
            id: track?.id || crypto.randomUUID(),
            userId: user.id,
            title,
            bpm,
            numChannels,
            numSteps,
            grid,
            channelSettings,
            selectedClips: selectedClipsForChannel,
            createdAt: Date.now()
        };
        const usedClipIds = new Set(Object.values(grid).flat());
        const usedClips = clips.filter(c => usedClipIds.has(c.id));
        const exportData = { type: "DROPIT_PROJECT", track: currentTrack, clips: usedClips };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `${title.replace(/\s+/g, '_')}_Config.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast({ title: "Project Config Exported" });
    };

    const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                if (data.type !== "DROPIT_PROJECT" && !data.patterns) throw new Error("Unsupported Format");

                if (data.clips) {
                    data.clips.forEach((clip: AudioClip) => db.saveClip({ ...clip, userId: user.id }));
                }

                const importedTrack = {
                    id: crypto.randomUUID(),
                    userId: user.id,
                    title: `IMPORTED_${data.track?.title || 'DAW_PATTERN'}`,
                    bpm: data.track?.bpm || data.bpm || 120,
                    numChannels: data.track?.numChannels || data.numChannels || 4,
                    numSteps: data.track?.numSteps || data.numSteps || 16,
                    grid: data.track?.grid || data.grid || {},
                    channelSettings: data.track?.channelSettings || data.channelSettings || {},
                    selectedClips: data.track?.selectedClips || data.selectedClips || {},
                    createdAt: Date.now()
                };

                db.saveTrack(importedTrack);
                toast({ title: "DAW Config Imported" });
                if (onImportRefresh) onImportRefresh();
                window.location.href = `/studio?id=${importedTrack.id}`;
            } catch (err) {
                toast({ title: "Import Failed", description: "Unknown config schema.", variant: "destructive" });
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleExportAudio = async () => {
        if (isExporting) return;
        setIsExporting(true);
        try {
            const secondsPerBeat = 60.0 / bpm;
            const secondsPerStep = secondsPerBeat / 4;
            const totalDuration = numSteps * secondsPerStep;
            const offlineCtx = new OfflineAudioContext(2, 44100 * totalDuration, 44100);
            for (let s = 0; s < numSteps; s++) {
                const timeOffset = s * secondsPerStep;
                for (let c = 0; c < numChannels; c++) {
                    const clipIds = grid[`${c}-${s}`];
                    if (clipIds) {
                        for (const id of clipIds) {
                            await playClip(id, c.toString(), timeOffset, offlineCtx);
                        }
                    }
                }
            }
            const renderedBuffer = await offlineCtx.startRendering();
            const wavBlob = audioBufferToWav(renderedBuffer);
            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${title.replace(/\s+/g, '_')}_Master.wav`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error(err);
            toast({ title: "Export Error", variant: "destructive" });
        } finally {
            setIsExporting(false);
        }
    };


    return (
        <div className="flex w-full flex-col lg:flex-row items-end justify-between gap-12 relative z-10">
            {/* Studio Header  */}
            <div className="flex-1 space-y-6 w-full">
                <div className=' flex gap-6 ' >
                    <div className=' flex justify-start items-center text-primary/60 border-r pr-6 border-primary/30 ' >

                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value.toUpperCase())}
                            className="text-3xl font-black italic tracking-tighter bg-transparent border-b border-primary/20 focus:ring-0 w-full outline-none text-primary"
                            placeholder="PROJECT_TITLE"
                        />
                        <Edit2Icon className="" />

                    </div>

                    <div className="flex gap-3">
                        <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary" onClick={handleSave} title="Save to Database"><Save className="w-5 h-5" /></Button>
                        <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary" onClick={handleExportConfig} title="Export Project JSON"><DownloadCloud className="w-5 h-5" /></Button>
                        <div className="relative">
                            <input type="file" accept=".json" onChange={handleImportConfig} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                            <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-black/40 text-primary" title="Import Project JSON"><Upload className="w-5 h-5" /></Button>
                        </div>
                        <Button size="icon" className="w-12 h-12 rounded-2xl gold-border bg-primary/20 text-primary" onClick={handleExportAudio} disabled={isExporting} title="Render Master WAV">
                            {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex items-center gap-4 h-full rounded-[2rem] px-8 py-4 border border-primary/20 flex-1 w-full bg-black/20">
                        <MasterVisualizer analyser={masterAnalyserRef ? masterAnalyserRef.current : null} />
                        <div className="flex flex-col gap-2">
                            <Button variant="ghost" size="sm" onClick={randomizePattern} className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary border border-primary/10 gap-2">
                                <Dices className="w-3.5 h-3.5" /> Randomize
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setGrid && setGrid({})} className="h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-500/20 gap-2"><X className="w-3.5 h-3.5" /> Clear</Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center border-primary/30 border px-3 py-4 rounded-lg   gap-10 h-full ">
                <div className="flex flex-col items-center gap-4 w-[80px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">BPM</span>
                    <div className="flex flex-col gap-3 w-full">
                        <input
                            type="text"
                            value={bpmInput}
                            onChange={(e) => setBpmInput(e.target.value)}
                            onBlur={() => {
                                let val = parseInt(bpmInput);
                                if (isNaN(val) || val < 60) val = 60;
                                else if (val > 240) val = 240;
                                setBpm(val);
                                setBpmInput(val.toString());
                            }}
                            className="bg-black/40 w-full px-4 py-4 rounded-2xl border border-white/5 font-black text-2xl text-primary text-center outline-none"
                        />
                        <Slider
                            value={[bpm]}
                            min={60}
                            max={240}
                            step={1}
                            onValueChange={(v) => {
                                setBpm(v[0]);
                                setBpmInput(v[0].toString());
                            }}
                            className="w-full"
                        />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-4 w-[80px]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Steps</span>
                    <div className="flex flex-col gap-3 w-full">
                        <input
                            type="text"
                            value={numStepsInput}
                            onChange={(e) => setNumStepsInput(e.target.value)}
                            onBlur={() => {
                                let val = parseInt(numStepsInput);
                                if (isNaN(val) || val < 4) val = 4;
                                else if (val > MAX_STEPS) val = MAX_STEPS;
                                setNumSteps(val);
                                setNumStepsInput(val.toString());
                            }}
                            className="bg-black/40 w-full px-4 py-4 rounded-2xl border border-white/5 font-black text-2xl text-primary text-center outline-none"
                        />
                        <Slider
                            value={[numSteps]}
                            min={4}
                            max={MAX_STEPS}
                            step={4}
                            onValueChange={(v) => {
                                setNumSteps(v[0]);
                                setNumStepsInput(v[0].toString());
                            }}
                            className="w-full"
                        />
                    </div>
                </div>
                <Button
                    variant={isPlaying ? "destructive" : "default"}
                    className={cn("w-[60] h-[60] rounded-[2.5rem] shadow-2xl transition-all", isPlaying ? "bg-red-500" : "bg-primary text-black")}
                    onClick={() => setIsPlaying(!isPlaying)}
                >
                    {isPlaying ? <Square className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                </Button>

            </div>
        </div>
    )
}