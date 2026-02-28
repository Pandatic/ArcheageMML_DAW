import React, { useRef, useEffect, useMemo } from 'react';
import { useSequence } from '../state/SequenceContext';

const ROW_HEIGHT = 35; // pixels per pitch row

export default function PianoKeys() {
    const canvasRef = useRef(null);
    const { state } = useSequence();

    const PITCHES = useMemo(() => {
        const PITCH_CLASSES = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];
        const pitches = [];
        for (let octave = state.visibleMaxOctave; octave >= state.visibleMinOctave; octave--) {
            for (let p of PITCH_CLASSES) {
                pitches.push(`${p}${octave}`);
            }
        }
        return pitches;
    }, [state.visibleMaxOctave, state.visibleMinOctave]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw horizontal lines (pitches) with keyboard styling securely safely explicitly
        PITCHES.forEach((pitch, i) => {
            const y = i * ROW_HEIGHT;

            const isBlackKey = pitch.includes('#');

            ctx.fillStyle = isBlackKey ? '#222' : '#ddd';
            ctx.fillRect(0, y, canvas.width, ROW_HEIGHT);

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.strokeStyle = '#333';
            ctx.stroke();

            // Draw pitch label distinctly clearly accurately natively functionally natively
            ctx.fillStyle = isBlackKey ? '#aaa' : '#000';
            ctx.font = '16px Arial';
            ctx.fillText(pitch, 5, y + 23);
        });

    }, [PITCHES]);

    return (
        <canvas
            ref={canvasRef}
            width={60}
            height={PITCHES.length * ROW_HEIGHT}
            style={{
                display: 'block',
                borderRight: '1px solid #444'
            }}
        />
    );
}
