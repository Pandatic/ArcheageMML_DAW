import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useSequence, getMMLLength, MAX_CANVAS_WIDTH } from '../state/SequenceContext';
import { getCurrentBeat, isTransportPlaying, seekToBeat } from '../audio/AudioPlayer';

const ROW_HEIGHT = 35; // pixels per pitch row
const RULER_HEIGHT = 24;

// Create shared diagonal stripe pattern canvas off-screen reliably efficiently natively structurally
const stripeCanvas = document.createElement('canvas');
stripeCanvas.width = 16;
stripeCanvas.height = 16;
const stripeCtx = stripeCanvas.getContext('2d');
stripeCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
stripeCtx.lineWidth = 4;
stripeCtx.beginPath();
stripeCtx.moveTo(0, 16);
stripeCtx.lineTo(16, 0);
stripeCtx.moveTo(-8, 8);
stripeCtx.lineTo(8, -8);
stripeCtx.moveTo(8, 24);
stripeCtx.lineTo(24, 8);
stripeCtx.stroke();

export default function PianoRoll() {
    const canvasRef = useRef(null);
    const { state, addNote, updateNote, deleteNote, updateMultipleNotes, selectedNoteIds, setSelectedNoteIds, totalCanvasBeats, pixelsPerBeat } = useSequence();

    const BEAT_WIDTH = pixelsPerBeat;

    // Dynamically calculate our bounding box based entirely off user UI dropdowns
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

    // Using track 1 for rendering the dummy notes
    const notes = state.tracks[0].notes;

    // Interaction State
    const [dragMode, setDragMode] = useState('none'); // 'none', 'move', 'resize', 'lasso'
    const [activeNoteId, setActiveNoteId] = useState(null);
    const [dragOffset, setDragOffset] = useState({ beatOffset: 0 });
    const [currentBeat, setCurrentBeat] = useState(0);
    const [hoverState, setHoverState] = useState({ beat: null, pitch: null });
    const [lassoBox, setLassoBox] = useState(null);

    const getPredictedColor = (beat, pitch) => {
        let availableTrackIndex = -1;
        for (let trackId = 1; trackId <= 3; trackId++) {
            const hasConflict = notes.some(note =>
                note.trackId === trackId &&
                !note.isIgnored &&
                note.startTime < beat + 1.0 &&
                note.startTime + note.duration > beat
            );
            if (!hasConflict) {
                availableTrackIndex = trackId;
                break;
            }
        }
        if (availableTrackIndex === 1) return '#41a6ffff';
        if (availableTrackIndex === 2) return '#39eb74ff';
        if (availableTrackIndex === 3) return '#bf47ff';
        return '#ff4444';
    };

    // Request Animation Frame Loop to constantly poll the Audio Engine
    useEffect(() => {
        let animationFrameId;

        const renderLoop = () => {
            setCurrentBeat(getCurrentBeat());
            animationFrameId = requestAnimationFrame(renderLoop);
        };

        renderLoop();

        return () => cancelAnimationFrame(animationFrameId);
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.lineWidth = 1;

        // Draw horizontal lines (pitches)
        PITCHES.forEach((pitch, i) => {
            const y = (i * ROW_HEIGHT) + RULER_HEIGHT;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.strokeStyle = '#333';
            ctx.stroke();
        });

        // Draw vertical lines (beats) across dynamic canvas length
        for (let i = 0; i <= totalCanvasBeats; i++) {
            const x = i * BEAT_WIDTH;
            ctx.beginPath();
            ctx.moveTo(x, RULER_HEIGHT);
            ctx.lineTo(x, canvas.height);
            // Emphasize every 4th beat to represent a measure
            ctx.strokeStyle = i % 4 === 0 ? '#666' : '#222';
            ctx.stroke();
        }

        // Draw Ruler at the top
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, RULER_HEIGHT);
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        for (let i = 0; i <= totalCanvasBeats; i++) {
            if (i % 4 === 0) {
                const x = i * BEAT_WIDTH;
                ctx.fillText(i.toString(), x + 5, 16);
            }
        }

        // Draw Ghost Note natively evaluating 3-Track Polyphony visually organically securely elegantly dynamically identically explicitly neatly accurately.
        if (hoverState.beat !== null && hoverState.pitch !== null) {
            const pitchIndex = PITCHES.indexOf(hoverState.pitch);
            if (pitchIndex !== -1) {
                const x = hoverState.beat * BEAT_WIDTH;
                const y = (pitchIndex * ROW_HEIGHT) + RULER_HEIGHT;
                const width = 1.0 * BEAT_WIDTH; // 1.0 default visualization mathematically exclusively solidly
                const height = ROW_HEIGHT;

                const predictedColor = getPredictedColor(hoverState.beat, hoverState.pitch);

                ctx.globalAlpha = 0.5;
                ctx.fillStyle = predictedColor;
                ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
                ctx.globalAlpha = 1.0;
            }
        }

        // Draw notes
        notes.forEach(note => {
            const pitchIndex = PITCHES.indexOf(note.pitch);
            if (pitchIndex === -1) return; // Skip if pitch is out of bounds for our simplified grid

            const x = note.startTime * BEAT_WIDTH;
            const y = (pitchIndex * ROW_HEIGHT) + RULER_HEIGHT;
            const width = note.duration * BEAT_WIDTH;
            const height = ROW_HEIGHT;

            // Draw note rectangle highlighting if actively interacted with
            if (note.isIgnored) {
                ctx.fillStyle = '#ff3c3cff'; // Pastel Red for discarded over-polyphony notes
            } else if (note.trackId === 1) {
                ctx.fillStyle = '#41a6ffff'; // Track 1 Blue
            } else if (note.trackId === 2) {
                ctx.fillStyle = '#39eb74ff'; // Track 2 Green
            } else if (note.trackId === 3) {
                ctx.fillStyle = '#bf47ff'; // Track 3 Purple
            } else {
                ctx.fillStyle = '#4facfe'; // fallback
            }

            ctx.fillRect(x + 1, y + 1, width - 2, height - 2);

            // Draw note border (Highlight white if selected)
            const isSelected = selectedNoteIds.includes(note.id);
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeStyle = isSelected ? '#ffffff' : '#000000';
            ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);

            const mmlLength = getMMLLength(note.duration);

            if (mmlLength.includes('&')) {
                const stripePattern = ctx.createPattern(stripeCanvas, 'repeat');
                ctx.fillStyle = stripePattern;
                ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
            }

            // Draw note pitch text inside the note blocks
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 16px Arial';
            // Only draw text if the block is wide enough
            if (width > 30) {
                ctx.fillText(mmlLength, x + 5, y + 23);
            }

            // Draw resize handle visual indicator on the right edge
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(x + width - 6, y + 1, 4, height - 2);
        });

        // Draw Interactive Playhead
        if (currentBeat > 0) {
            // Rule 4 Math: Translate the Tone.js 'beats' floating value into exact Canvas pixel bounds (Beats * Beat Width)
            const playheadX = currentBeat * BEAT_WIDTH;
            ctx.beginPath();
            ctx.moveTo(playheadX, RULER_HEIGHT);
            ctx.lineTo(playheadX, canvas.height);
            ctx.strokeStyle = '#ff0000'; // Distinct Red Line
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        if (lassoBox) {
            const minX = Math.min(lassoBox.startX, lassoBox.currentX);
            const maxX = Math.max(lassoBox.startX, lassoBox.currentX);
            const minY = Math.min(lassoBox.startY, lassoBox.currentY);
            const maxY = Math.max(lassoBox.startY, lassoBox.currentY);

            ctx.fillStyle = 'rgba(65, 166, 255, 0.3)';
            ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
            ctx.strokeStyle = '#41a6ff';
            ctx.lineWidth = 1;
            ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        }

    }, [notes, activeNoteId, currentBeat, PITCHES, totalCanvasBeats, hoverState, pixelsPerBeat, selectedNoteIds, lassoBox]);

    const handleMouseDown = (e) => {
        if (e.button !== 0) return; // Ignore right/middle clicks to reserve for delete/other actions

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Translate raw pixels to Beat and Pitch based on grid sizing
        const rawBeat = x / BEAT_WIDTH;
        const snappedBeat = Math.round(rawBeat / state.snapResolution) * state.snapResolution;

        // Transport seek interception via ruler bound mapping organically explicit
        if (y <= RULER_HEIGHT) {
            setDragMode('seek');
            seekToBeat(Math.max(0, snappedBeat));
            return; // Prevent notes securely effectively efficiently cleanly smartly flawlessly gracefully reliably smoothly seamlessly properly identically seamlessly symmetrically
        }

        // Translate Y to pitch
        const gridY = y - RULER_HEIGHT;
        const pitchIndex = Math.floor(gridY / ROW_HEIGHT);
        if (pitchIndex < 0 || pitchIndex >= PITCHES.length) return;

        const clickedPitch = PITCHES[pitchIndex];

        // Check if the click intersects with an existing note based on musical logic
        const clickedNote = notes.find(note =>
            note.pitch === clickedPitch &&
            rawBeat >= note.startTime &&
            rawBeat < note.startTime + note.duration
        );

        if (clickedNote) {
            // Edge Detection Math:
            // Calculate precisely where the right edge of this note is rendered on the X-axis mapping
            const noteRightEdgePixel = (clickedNote.startTime + clickedNote.duration) * BEAT_WIDTH;

            // If the mouse X is within 10 pixels strictly inside of the note's right edge
            if (noteRightEdgePixel - x <= 10) {
                setDragMode('resize');
                setActiveNoteId(clickedNote.id);
                if (!selectedNoteIds.includes(clickedNote.id)) {
                    if (e.shiftKey) {
                        setSelectedNoteIds(prev => [...prev, clickedNote.id]);
                    } else {
                        setSelectedNoteIds([clickedNote.id]);
                    }
                }
            } else {
                setDragMode('move');
                setActiveNoteId(clickedNote.id);

                if (!selectedNoteIds.includes(clickedNote.id)) {
                    if (e.shiftKey) {
                        setSelectedNoteIds(prev => [...prev, clickedNote.id]);
                    } else {
                        setSelectedNoteIds([clickedNote.id]);
                    }
                }

                // We calculate a beat offset so moving the note doesn't jarringly snap its start directly to the user's mouse pointer
                setDragOffset({
                    beatOffset: clickedNote.startTime - rawBeat
                });
            }
        } else {
            // Clicked empty space
            if (e.shiftKey) {
                // Shift is held: Start Lasso Selection
                setDragMode('lasso');
                setLassoBox({ startX: x, startY: y, currentX: x, currentY: y });
                // Note: We deliberately do NOT clear selectedNoteIds here, 
                // so users can shift-lasso multiple separate groups!
            } else {
                // Normal Click: Clear selection and spawn a new note
                setSelectedNoteIds([]);
                addNote(PITCHES[pitchIndex], Math.max(0, snappedBeat), 1.0);
            }
        }
    };

    const handleMouseMove = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const rawBeat = x / BEAT_WIDTH;
        const snappedBeat = Math.round(rawBeat / state.snapResolution) * state.snapResolution;

        if (dragMode === 'seek') {
            seekToBeat(Math.max(0, snappedBeat));
            return;
        }

        if (dragMode === 'lasso') {
            setLassoBox(prev => ({ ...prev, currentX: x, currentY: y }));
            return;
        }

        if (dragMode === 'none' || !activeNoteId) {
            const gridY = y - RULER_HEIGHT;
            const pitchIndex = Math.floor(gridY / ROW_HEIGHT);

            if (pitchIndex >= 0 && pitchIndex < PITCHES.length) {
                if (hoverState.beat !== snappedBeat || hoverState.pitch !== PITCHES[pitchIndex]) {
                    setHoverState({ beat: snappedBeat, pitch: PITCHES[pitchIndex] });
                }
            } else if (hoverState.beat !== null) {
                setHoverState({ beat: null, pitch: null });
            }
            return;
        }

        const activeNote = notes.find(n => n.id === activeNoteId);
        if (!activeNote) return;

        if (dragMode === 'move') {
            // Rule 4: Mathematical grid-snapping for Move.
            // 1. Convert pixel x to raw fractional beats.
            // 2. Add the initial grab offset so the note body feels solid relative to the mouse cursor.
            // 3. Round to nearest snap grid line
            const rawBeat = x / BEAT_WIDTH;
            let newStartTime = Math.round((rawBeat + dragOffset.beatOffset) / state.snapResolution) * state.snapResolution;

            // Bounds check so the note cannot drop below the start of the song
            if (newStartTime < 0) newStartTime = 0;

            const gridY = y - RULER_HEIGHT;
            const pitchIndex = Math.floor(gridY / ROW_HEIGHT);
            const activePitchIndex = PITCHES.indexOf(activeNote.pitch);

            const beatDelta = newStartTime - activeNote.startTime;
            const pitchDelta = pitchIndex - activePitchIndex;

            if (beatDelta !== 0 || pitchDelta !== 0) {
                const groupIds = selectedNoteIds.includes(activeNoteId) ? selectedNoteIds : [activeNoteId];

                const updates = groupIds.map(nId => {
                    const n = notes.find(nn => nn.id === nId);
                    if (!n) return null;

                    let targetStart = n.startTime + beatDelta;
                    if (targetStart < 0) targetStart = 0;

                    let oldPIndex = PITCHES.indexOf(n.pitch);
                    let targetPIndex = oldPIndex + pitchDelta;
                    targetPIndex = Math.max(0, Math.min(PITCHES.length - 1, targetPIndex));

                    return { id: nId, updatedFields: { startTime: targetStart, pitch: PITCHES[targetPIndex] } };
                }).filter(Boolean);

                if (updates.length > 0) {
                    updateMultipleNotes(updates);
                }
            }
        } else if (dragMode === 'resize') {
            // Rule 4: Mathematical grid-snapping for Resize.
            // 1. Take raw mouse X and convert to floating pointer Beat timeline mapping.
            // 2. Snap the end tail to the nearest grid line via mathematical rounding.
            const rawMouseBeat = x / BEAT_WIDTH;
            const newEndBeat = Math.round(rawMouseBeat / state.snapResolution) * state.snapResolution;

            // 3. Re-calculate duration constraint as End Beat minus fixed Start Time
            let newDuration = newEndBeat - activeNote.startTime;

            // Bounds check so duration cannot drop below a 64th note minimum length (0.0625)
            if (newDuration < 0.0625) {
                newDuration = 0.0625;
            }

            if (newDuration !== activeNote.duration) {
                updateNote(activeNoteId, { duration: newDuration });
            }
        }
    };

    const handleMouseUp = () => {
        if (dragMode === 'lasso' && lassoBox) {
            const minX = Math.min(lassoBox.startX, lassoBox.currentX);
            const maxX = Math.max(lassoBox.startX, lassoBox.currentX);
            const minY = Math.min(lassoBox.startY, lassoBox.currentY);
            const maxY = Math.max(lassoBox.startY, lassoBox.currentY);

            const newSelected = [];
            notes.forEach(note => {
                const pIndex = PITCHES.indexOf(note.pitch);
                if (pIndex === -1) return;

                const noteX = note.startTime * BEAT_WIDTH;
                const noteW = note.duration * BEAT_WIDTH;
                const noteY = (pIndex * ROW_HEIGHT) + RULER_HEIGHT;

                if (noteX < maxX && (noteX + noteW) > minX && noteY < maxY && (noteY + ROW_HEIGHT) > minY) {
                    newSelected.push(note.id);
                }
            });

            setSelectedNoteIds(prev => [...new Set([...prev, ...newSelected])]);
            setLassoBox(null);
        }
        setDragMode('none');
        setActiveNoteId(null);
    };

    const handleMouseLeave = () => {
        setDragMode('none');
        setActiveNoteId(null);
        setLassoBox(null);
        setHoverState({ beat: null, pitch: null });
    };

    const handleContextMenu = (e) => {
        e.preventDefault(); // Prevent standard right-click context menu popping up over canvas

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const rawBeat = x / BEAT_WIDTH;
        const gridY = y - RULER_HEIGHT;
        const pitchIndex = Math.floor(gridY / ROW_HEIGHT);
        if (pitchIndex < 0 || pitchIndex >= PITCHES.length) return;

        const clickedPitch = PITCHES[pitchIndex];

        // Find intersecting note to delete it
        const clickedNote = notes.find(note =>
            note.pitch === clickedPitch &&
            rawBeat >= note.startTime &&
            rawBeat < note.startTime + note.duration
        );

        if (clickedNote) {
            deleteNote(clickedNote.id);
        }
    };

    const exactHeight = (PITCHES.length * ROW_HEIGHT) + RULER_HEIGHT;

    return (
        <canvas
            ref={canvasRef}
            width={Math.min(totalCanvasBeats * BEAT_WIDTH, MAX_CANVAS_WIDTH)}
            height={exactHeight}
            style={{
                display: 'block',
                cursor: dragMode === 'resize' ? 'e-resize' : (dragMode === 'move' ? 'grabbing' : 'auto'),
                flexShrink: 0,
                minHeight: `${exactHeight}px`,
                maxHeight: `${exactHeight}px`
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onContextMenu={handleContextMenu} // Right click to delete
        />
    );
}
