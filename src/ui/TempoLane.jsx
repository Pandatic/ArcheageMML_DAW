import React, { useRef, useEffect, useState } from 'react';
import { useSequence, MAX_CANVAS_WIDTH } from '../state/SequenceContext';

const ROW_HEIGHT = 100; // Fixed canvas height UI layer 
const PADDING = 15;

export default function TempoLane() {
    const canvasRef = useRef(null);
    const { state, totalCanvasBeats, pixelsPerBeat, updateNote } = useSequence();
    const [draggingNoteId, setDraggingNoteId] = useState(null);

    const BEAT_WIDTH = pixelsPerBeat;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Reset buffer block
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 1. Draw Vertical Bars (Beats) synchronized exactly directly
        ctx.lineWidth = 1;
        for (let i = 0; i <= totalCanvasBeats; i++) {
            const x = i * BEAT_WIDTH;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            // Emphasize every 4th beat to represent a measure block exactly
            ctx.strokeStyle = i % 4 === 0 ? '#666' : '#222';
            ctx.stroke();
        }

        // 2. Draw Horizontal UI Constraints safely bound between 32 and 255 natively
        ctx.beginPath();
        ctx.moveTo(0, ROW_HEIGHT); // Min (32) at bottom
        ctx.lineTo(canvas.width, ROW_HEIGHT);
        ctx.moveTo(0, 0); // Max (255) at top
        ctx.lineTo(canvas.width, 0);

        ctx.moveTo(0, ROW_HEIGHT / 2); // Mid-point
        ctx.lineTo(canvas.width, ROW_HEIGHT / 2);

        ctx.strokeStyle = '#444';
        ctx.stroke();

        // 3. Label Text UI explicitly bounds
        ctx.fillStyle = '#888';
        ctx.font = '10px Arial';
        ctx.fillText('255', 5, 12);
        ctx.fillText('32', 5, ROW_HEIGHT - 5);

        // 4. Draw Tempo Nodes step-graph derived entirely from Track 1 Note Data natively
        const track1Notes = state.tracks[0]?.notes || [];
        const sortedNotes = track1Notes.filter(n => n.trackId === 1 && !n.isIgnored).sort((a, b) => a.startTime - b.startTime);

        if (sortedNotes.length === 0) return;

        ctx.beginPath();
        let first = true;
        let lastY = 0;

        sortedNotes.forEach(note => {
            const x = note.startTime * BEAT_WIDTH;
            const validBpm = note.bpm !== undefined ? note.bpm : 120; // Default ArcheAge sequence boot constraint fallback explicitly logically gracefully

            // Native mapping: scale note.bpm mathematically cleanly bounds 32-255 inside canvas height gracefully
            const percentage = (validBpm - 32) / (255 - 32);
            const y = ROW_HEIGHT - PADDING - (Math.max(0, Math.min(1, percentage)) * (ROW_HEIGHT - PADDING * 2));

            if (first) {
                ctx.moveTo(x, y);
                first = false;
            } else {
                ctx.lineTo(x, lastY); // Horizontal projection exclusively
                ctx.lineTo(x, y);     // True vertical step bounds exactly mathematically
            }
            lastY = y;
        });

        // Ensure automation tail correctly drags across screen seamlessly globally visually rightward
        if (sortedNotes.length > 0) {
            ctx.lineTo(canvas.width, lastY);
        }

        // Specifically set Orange explicitly
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw node circles exclusively matching identical step coordinates cleanly
        sortedNotes.forEach(note => {
            const x = note.startTime * BEAT_WIDTH;
            const validBpm = note.bpm !== undefined ? note.bpm : 120;
            const percentage = (validBpm - 32) / (255 - 32);
            const y = ROW_HEIGHT - PADDING - (Math.max(0, Math.min(1, percentage)) * (ROW_HEIGHT - PADDING * 2));

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();

            // Draw floating numerical BPM overlay UI efficiently natively bound cleanly floating safely
            ctx.fillStyle = '#ffb347';
            ctx.font = '10px Arial';
            ctx.fillText(validBpm, x - 10, y < 20 ? y + 20 : y - 15);
        });

    }, [totalCanvasBeats, state.tracks, pixelsPerBeat]);

    const handleMouseDown = (e) => {
        if (e.button !== 0) return; // Ignore right click mapping cleanly

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const track1Notes = state.tracks[0]?.notes || [];
        const sortedNotes = track1Notes.filter(n => n.trackId === 1 && !n.isIgnored).sort((a, b) => a.startTime - b.startTime);

        // Collision logic
        const clickedNote = sortedNotes.find(note => {
            const noteX = note.startTime * BEAT_WIDTH;
            const validBpm = note.bpm !== undefined ? note.bpm : 120;
            const percentage = (validBpm - 32) / (255 - 32);
            const noteY = ROW_HEIGHT - PADDING - (Math.max(0, Math.min(1, percentage)) * (ROW_HEIGHT - PADDING * 2));
            return Math.abs(x - noteX) <= 10 && Math.abs(y - noteY) <= 10;
        });

        if (clickedNote) {
            if (e.shiftKey) {
                // Shift+Click precise entry parsing implicitly exact mapping exclusively
                const validBpm = clickedNote.bpm !== undefined ? clickedNote.bpm : 120;
                const input = window.prompt('Enter exact BPM (32-255):', validBpm);
                if (input !== null) {
                    const parsed = parseInt(input, 10);
                    if (!isNaN(parsed)) {
                        const clampedBpm = Math.min(255, Math.max(32, parsed));
                        updateNote(clickedNote.id, { bpm: clampedBpm });
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

        // Invert natively converting Y pixels perfectly explicitly to ArcheAge limits exactly physically seamlessly
        const percentage = 1 - ((y - PADDING) / (ROW_HEIGHT - PADDING * 2));
        let newBpm = Math.round(32 + (percentage * (255 - 32)));
        newBpm = Math.max(32, Math.min(255, newBpm));

        updateNote(draggingNoteId, { bpm: newBpm });
    };

    const handleMouseUp = () => {
        setDraggingNoteId(null);
    };

    const handleContextMenu = (e) => {
        e.preventDefault();

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const track1Notes = state.tracks[0]?.notes || [];
        const sortedNotes = track1Notes.filter(n => n.trackId === 1 && !n.isIgnored).sort((a, b) => a.startTime - b.startTime);

        const clickedNoteIndex = sortedNotes.findIndex(note => {
            const noteX = note.startTime * BEAT_WIDTH;
            const validBpm = note.bpm !== undefined ? note.bpm : 120;
            const percentage = (validBpm - 32) / (255 - 32);
            const noteY = ROW_HEIGHT - PADDING - (Math.max(0, Math.min(1, percentage)) * (ROW_HEIGHT - PADDING * 2));
            return Math.abs(x - noteX) <= 10 && Math.abs(y - noteY) <= 10;
        });

        if (clickedNoteIndex > 0) { // Safely protect against evaluating bounds lacking preceding steps mapping seamlessly
            const precedingNote = sortedNotes[clickedNoteIndex - 1];
            updateNote(sortedNotes[clickedNoteIndex].id, { bpm: precedingNote.bpm !== undefined ? precedingNote.bpm : 120 });
        }
    };

    return (
        <canvas
            ref={canvasRef}
            width={Math.min(totalCanvasBeats * BEAT_WIDTH, MAX_CANVAS_WIDTH)}
            height={ROW_HEIGHT}
            style={{ display: 'block', cursor: 'crosshair', backgroundColor: '#111', borderBottom: '1px solid #444', marginBottom: '10px' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onContextMenu={handleContextMenu}
        />
    );
}
