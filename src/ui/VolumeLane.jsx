import React, { useRef, useEffect, useState } from 'react';
import { useSequence, MAX_CANVAS_WIDTH } from '../state/SequenceContext';

const ROW_HEIGHT = 100; // Fixed canvas height UI layer 
const PADDING = 15;

export default function VolumeLane({ trackId, trackColor }) {
    const canvasRef = useRef(null);
    const { state, totalCanvasBeats, pixelsPerBeat, updateNote } = useSequence();
    const [draggingNoteId, setDraggingNoteId] = useState(null);

    const BEAT_WIDTH = pixelsPerBeat;

    // Canvas Render Engine Wrapper
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Reset buffer block
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw Vertical Bars (Beats) synchronized exactly to PianoRoll
        ctx.lineWidth = 1;
        for (let i = 0; i <= totalCanvasBeats; i++) {
            const x = i * BEAT_WIDTH;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            // Emphasize every 4th beat to represent a measure block exactly like PianoRoll
            ctx.strokeStyle = i % 4 === 0 ? '#666' : '#222';
            ctx.stroke();
        }

        // 2. Draw Horizontal UI Constraints safely bound between 0 and 127
        ctx.beginPath();
        // Native ArcheAge 0 Volume (Bottom Edge)
        ctx.moveTo(0, ROW_HEIGHT);
        ctx.lineTo(canvas.width, ROW_HEIGHT);

        // Native ArcheAge 127 Volume (Top Bounds)
        ctx.moveTo(0, 0);
        ctx.lineTo(canvas.width, 0);

        // Mid-point tracker for aesthetic UI UI
        ctx.moveTo(0, ROW_HEIGHT / 2);
        ctx.lineTo(canvas.width, ROW_HEIGHT / 2);

        ctx.strokeStyle = '#444';
        ctx.stroke();

        // 3. Label Text UI limits natively 
        ctx.fillStyle = '#888';
        ctx.font = '10px Arial';
        ctx.fillText('127', 5, 12);
        ctx.fillText('0', 5, ROW_HEIGHT - 5);

        // 4. Draw Automation Nodes Graphically Loop tied directly to Notes State
        const activeTrack = state.tracks[0];
        if (!activeTrack) return;

        const sortedNotes = activeTrack.notes.filter(n => n.trackId === trackId && !n.isIgnored).sort((a, b) => a.startTime - b.startTime);
        if (sortedNotes.length === 0) return;

        // Draw connecting step-wise lines 
        ctx.beginPath();
        let first = true;
        let lastY = 0;

        sortedNotes.forEach(note => {
            const x = note.startTime * BEAT_WIDTH;
            // Inverse Y-axis math projection: 127 is top (0px), 0 is bottom (100px)
            const y = ROW_HEIGHT - PADDING - ((Math.max(0, Math.min(127, note.velocity)) / 127) * (ROW_HEIGHT - PADDING * 2));

            if (first) {
                ctx.moveTo(x, y);
                first = false;
            } else {
                ctx.lineTo(x, lastY); // Horizontal from Node A to Node B's X
                ctx.lineTo(x, y);     // Vertical strictly tracking to Node B's Y
            }
            lastY = y;
        });

        // Adhere strictly to the requested canonical DAW tracked native colors
        ctx.strokeStyle = trackColor;

        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw isolated intersection node anchor points matching corresponding exact color
        sortedNotes.forEach(note => {
            const x = note.startTime * BEAT_WIDTH;
            const y = ROW_HEIGHT - PADDING - ((Math.max(0, Math.min(127, note.velocity)) / 127) * (ROW_HEIGHT - PADDING * 2));
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();

            // Draw floating numerical Volume overlay UI efficiently natively bound cleanly floating safely
            ctx.fillStyle = trackColor;
            ctx.font = '10px Arial';
            ctx.fillText(note.velocity, x - 10, y < 20 ? y + 20 : y - 15);
        });

    }, [totalCanvasBeats, state.tracks, trackId, trackColor, pixelsPerBeat]);

    const handleMouseDown = (e) => {
        if (e.button !== 0) return; // Only process left clicks

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const activeTrack = state.tracks[0];
        if (!activeTrack) return;

        // Find if a note was clicked based on strict collision boundaries
        const clickedNote = activeTrack.notes.find(note => {
            if (note.trackId !== trackId || note.isIgnored) return false;
            const noteX = note.startTime * BEAT_WIDTH;
            const noteY = ROW_HEIGHT - PADDING - ((Math.max(0, Math.min(127, note.velocity)) / 127) * (ROW_HEIGHT - PADDING * 2));
            return Math.abs(x - noteX) <= 10 && Math.abs(y - noteY) <= 10;
        });

        if (clickedNote) {
            if (e.shiftKey) {
                // Shift+Click precise entry parsing implicitly exact mapping exclusively
                const input = window.prompt('Enter exact Volume (0-127):', clickedNote.velocity);
                if (input !== null) {
                    const parsed = parseInt(input, 10);
                    if (!isNaN(parsed)) {
                        const clampedValue = Math.min(127, Math.max(0, parsed));
                        updateNote(clickedNote.id, { velocity: clampedValue });
                    }
                }
            } else {
                setDraggingNoteId(clickedNote.id);
            }
        }
    };

    const handleMouseMove = (e) => {
        if (!draggingNoteId) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const y = e.clientY - rect.top;

        // Calculate clamped 0-127 volume boundaries securely based entirely on user's current cursor Y height explicitly
        let newVolume = Math.round((1 - ((y - PADDING) / (ROW_HEIGHT - PADDING * 2))) * 127);
        newVolume = Math.max(0, Math.min(127, newVolume));

        updateNote(draggingNoteId, { velocity: newVolume });
    };

    const handleMouseUp = () => {
        setDraggingNoteId(null);
    };

    const handleContextMenu = (e) => {
        e.preventDefault(); // Prevent standard right-click context menu popping up over canvas

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const activeTrack = state.tracks[0];
        if (!activeTrack) return;

        const sortedNotes = activeTrack.notes.filter(n => n.trackId === trackId && !n.isIgnored).sort((a, b) => a.startTime - b.startTime);

        const clickedNoteIndex = sortedNotes.findIndex(note => {
            const noteX = note.startTime * BEAT_WIDTH;
            const noteY = ROW_HEIGHT - PADDING - ((Math.max(0, Math.min(127, note.velocity)) / 127) * (ROW_HEIGHT - PADDING * 2));
            return Math.abs(x - noteX) <= 10 && Math.abs(y - noteY) <= 10;
        });

        if (clickedNoteIndex > 0) { // Must safely have an explicitly evaluated preceding note node
            const precedingNote = sortedNotes[clickedNoteIndex - 1];
            updateNote(sortedNotes[clickedNoteIndex].id, { velocity: precedingNote.velocity });
        }
    };

    // Return Raw Canvas for Native App CSS layout bindings securely
    return (
        <canvas
            ref={canvasRef}
            width={Math.min(totalCanvasBeats * BEAT_WIDTH, MAX_CANVAS_WIDTH)}
            height={ROW_HEIGHT}
            style={{ display: 'block', cursor: 'crosshair', marginTop: '10px', backgroundColor: '#111', borderTop: '1px solid #444', borderBottom: '1px solid #444' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
        />
    );
}
