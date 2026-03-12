import { ChannelSettings } from "@/lib/db";
import { throttle } from "@/lib/utils";
import React, { useEffect, useState } from "react";
interface PanControlProps {
    setChannelSettings: React.Dispatch<React.SetStateAction<Record<string, ChannelSettings>>>,
    chKey: string,
    s: ChannelSettings
}

export default function PanControl(props: PanControlProps) {

    const { setChannelSettings, chKey, s } = props

    return (
        <div className=" border-x px-2 flex relative justify-between cursor-ns-resize items-center "
            key={chKey}
            id={chKey}
            title="Panning"
            onMouseDown={(e) => {
                const startY = e.clientY;
                const startPan = s.pan;
                const handleMove = (me: MouseEvent) => {
                    const delta = (startY - me.clientY) * 0.01;
                    setChannelSettings(p => ({ ...p, [chKey]: { ...p[chKey], pan: Math.max(-1, Math.min(1, startPan + delta)) } }));
                };
                const handleUp = () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
                window.addEventListener('mousemove', handleMove); window.addEventListener('mouseup', handleUp);
            }}
        >
            <div className="w-6 h-6 transition-transform rounded-full border-dotted border-[#f8f8f8] bg-[#343536] shadow-dbtn p-1 flex items-center justify-center relative cursor-ns-resize group/knob"
                style={{ transform: `rotate(${s.pan * 90}deg)` }}
            >
                <div className="absolute  top-1 daw-button-inner w-[2] h-[25%] rounded bg-primary/40 origin-center " />
            </div> 
            <span className=" px-1 text-[5px] text-muted-foreground" >
                -
            </span>
            <p className=" px-1  top-[50%] text-[5px] text-muted-foreground " >{(s.pan * 100).toFixed(0)} </p>


        </div>
    )
}