import { db, User, AudioClip, Track, ChannelSettings, NoteProperty } from '@/lib/db';
import { useCallback, useRef } from 'react';

interface AudioProps {
    clips: AudioClip[]
    channelSettingsRef: React.RefObject<Record<string, ChannelSettings>>
    DEFAULT_CHANNEL_SETTINGS: ChannelSettings
    audioContextRef:React.RefObject<AudioContext | null>,
    masterAnalyserRef:React.RefObject<AnalyserNode | null>
}

export default function useAudio(props: AudioProps) {

  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});

    const { clips, channelSettingsRef, DEFAULT_CHANNEL_SETTINGS, audioContextRef, masterAnalyserRef }= props


    const initAudio = useCallback(() => {
        if (!audioContextRef.current) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.connect(ctx.destination);
            masterAnalyserRef.current = analyser;
            audioContextRef.current = ctx;
        }
        return audioContextRef.current;
    }, []);

    const loadBuffer = async (clip: AudioClip, ctx: AudioContext) => {
        if (audioBuffersRef.current[clip.id]) return audioBuffersRef.current[clip.id];
        try {
            const res = await fetch(clip.audioData);
            const ab = await res.arrayBuffer();
            const buffer = await ctx.decodeAudioData(ab);
            audioBuffersRef.current[clip.id] = buffer;
            return buffer;
        } catch (e) { return null; }
    };

    const playNote = useCallback(async (note: NoteProperty, chIdx: string, time: number) => {
        const ctx = initAudio();
        const s = channelSettingsRef.current[chIdx] || DEFAULT_CHANNEL_SETTINGS;
        if (s.muted) return;

        const clip = clips.find(c => c.id === note.clipId);
        if (!clip) return;

        const buffer = await loadBuffer(clip, ctx);
        if (!buffer) return;

        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        const panNode = ctx.createStereoPanner();
        const filterNode = ctx.createBiquadFilter();

        const safeVolume = isFinite(s.volume) ? s.volume : 0.8;
        const safePan = isFinite(s.pan) ? Math.max(-1, Math.min(1, s.pan)) : 0;
        const safePitch = isFinite(s.pitch) ? Math.max(0.1, s.pitch) : 1.0;

        const safeVelocity = isFinite(note.velocity) ? note.velocity : 1.0;
        const safeFinePitch = isFinite(note.finePitch) ? note.finePitch : 0;
        const notePanOffset = isFinite(note.panOffset) ? note.panOffset : 0;
        const noteCutoffOffset = isFinite(note.cutoffOffset) ? note.cutoffOffset : 0;
        const noteResOffset = isFinite(note.resOffset) ? note.resOffset : 0;

        const finalPitch = safePitch * Math.pow(2, safeFinePitch / 1200);
        const finalVol = safeVelocity * safeVolume;
        const finalPan = Math.max(-1, Math.min(1, safePan + notePanOffset));

        source.buffer = buffer;
        source.playbackRate.setValueAtTime(isFinite(finalPitch) ? finalPitch : 1.0, time);
        panNode.pan.setValueAtTime(finalPan, time);
        gainNode.gain.setValueAtTime(isFinite(finalVol) ? finalVol : 0.8, time);

        if (s.svfActive) {
            filterNode.type = s.svfType || 'lowpass';
            const baseCut = isFinite(s.svfCut) ? s.svfCut : 1.0;
            const finalCut = Math.max(0, Math.min(1, baseCut + noteCutoffOffset));
            const freq = Math.max(20, Math.min(20000, 20 + (Math.pow(finalCut, 2) * 19980)));

            const baseRes = isFinite(s.svfEmph) ? s.svfEmph : 0.2;
            const finalRes = Math.max(0, Math.min(1, baseRes + noteResOffset));

            filterNode.frequency.setValueAtTime(freq, time);
            filterNode.Q.setValueAtTime(Math.max(0.0001, finalRes * 20), time);
        } else {
            filterNode.type = 'allpass';
        }

        source.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(masterAnalyserRef.current || ctx.destination);

        source.start(time);
    }, [clips, initAudio]);


    return { initAudio, loadBuffer, playNote }
}

