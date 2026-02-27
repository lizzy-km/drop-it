import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

//  const handleExportConfig = () => {
//     const currentTrack: Track = {
//       id: track?.id || crypto.randomUUID(),
//       userId: user.id,
//       title,
//       bpm,
//       numChannels,
//       numSteps,
//       grid,
//       channelSettings,
//       selectedClips: selectedClipsForChannel,
//       createdAt: Date.now()
//     };
//     const usedClipIds = new Set(Object.values(grid).flat());
//     const usedClips = clips.filter(c => usedClipIds.has(c.id));
//     const exportData = { type: "DROPIT_PROJECT", track: currentTrack, clips: usedClips };
//     const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement('a');
//     a.href = url;
//     a.download = `${title.replace(/\s+/g, '_')}_Config.json`;
//     a.click();
//     URL.revokeObjectURL(url);
//     toast({ title: "Config Exported" });
//   };

//   const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onload = (event) => {
//       try {
//         const data = JSON.parse(event.target?.result as string);
//         // Flexible DAW Import Layer
//         if (data.type !== "DROPIT_PROJECT" && !data.patterns) throw new Error("Unsupported Format");
        
//         if (data.clips) {
//            data.clips.forEach((clip: AudioClip) => db.saveClip({ ...clip, userId: user.id }));
//         }
        
//         const importedTrack = { 
//           id: crypto.randomUUID(),
//           userId: user.id,
//           title: `IMPORTED_${data.track?.title || 'DAW_PATTERN'}`,
//           bpm: data.track?.bpm || data.bpm || 120,
//           numChannels: data.track?.numChannels || data.numChannels || 4,
//           numSteps: data.track?.numSteps || data.numSteps || 16,
//           grid: data.track?.grid || data.grid || {},
//           channelSettings: data.track?.channelSettings || data.channelSettings || {},
//           selectedClips: data.track?.selectedClips || data.selectedClips || {},
//           createdAt: Date.now()
//         };
        
//         db.saveTrack(importedTrack);
//         toast({ title: "DAW Config Imported" });
//         if (onImportRefresh) onImportRefresh();
//         window.location.href = `/studio?id=${importedTrack.id}`;
//       } catch (err) {
//         toast({ title: "Import Failed", description: "Unknown config schema.", variant: "destructive" });
//       }
//     };
//     reader.readAsText(file);
//   };
