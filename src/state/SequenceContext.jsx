import React, { createContext, useContext, useReducer, useState, useMemo } from 'react';
import { evaluatePolyphony } from '../engine/polyphonyEvaluator';

const DEFAULT_MIN_BEATS = 32;
const BUFFER_BEATS = 20;

export function getUsedOctaveRange(notesArray) {
    if (!notesArray || notesArray.length === 0) return { min: null, max: null };

    let min = Infinity;
    let max = -Infinity;

    notesArray.forEach(note => {
        const match = note.pitch.match(/^([A-G])([#b]?)(-?\d+)$/i);
        if (match) {
            const octave = parseInt(match[3], 10);
            if (octave < min) min = octave;
            if (octave > max) max = octave;
        }
    });

    return {
        min: min === Infinity ? null : min,
        max: max === -Infinity ? null : max
    };
}

const MML_LENGTHS = [
    { beats: 4.0, str: '1' },
    { beats: 3.0, str: '2.' },
    { beats: 2.0, str: '2' },
    { beats: 1.5, str: '4.' },
    { beats: 1.0, str: '4' },
    { beats: 0.75, str: '8.' },
    { beats: 0.5, str: '8' },
    { beats: 0.375, str: '16.' },
    { beats: 0.25, str: '16' },
    { beats: 0.1875, str: '32.' },
    { beats: 0.125, str: '32' },
    { beats: 0.09375, str: '64.' },
    { beats: 0.0625, str: '64' }
];

export function getMMLLength(durationInBeats) {
    if (durationInBeats <= 0) return '';

    // Step 1: Check perfect base match
    const baseMatch = MML_LENGTHS.find(m => Math.abs(durationInBeats - m.beats) < 0.0001 && !m.str.includes('.'));
    if (baseMatch) return baseMatch.str;

    // Step 2: Check perfect dotted match
    const dottedMatch = MML_LENGTHS.find(m => Math.abs(durationInBeats - m.beats) < 0.0001 && m.str.includes('.'));
    if (dottedMatch) return dottedMatch.str;

    // Step 3: Greedy split for fractional remainder ties
    let remaining = durationInBeats;
    let parts = [];

    // Prioritize clean bases for the greedy subtraction exactly
    const bases = MML_LENGTHS.filter(m => !m.str.includes('.'));

    for (const base of bases) {
        if (remaining <= 0.0001) break;
        while (remaining >= base.beats - 0.0001) {
            parts.push(base.str);
            remaining -= base.beats;
        }
    }

    return parts.join('&');
}

// --- Types & Initial State ---
const initialNotes = [];

const INITIAL_STATE = {
    tracks: [
        {
            id: 1,
            name: 'Track 1',
            notes: evaluatePolyphony(initialNotes)
        },
        { id: 2, name: 'Track 2', notes: [] },
        { id: 3, name: 'Track 3', notes: [] }
    ],
    bpm: 120,
    visibleMinOctave: 3,
    visibleMaxOctave: 5,
    snapResolution: 0.25
};

// --- Actions ---
export const ACTIONS = {
    ADD_NOTE: 'ADD_NOTE',
    UPDATE_NOTE: 'UPDATE_NOTE',
    DELETE_NOTE: 'DELETE_NOTE',
    CLEAR_TRACK: 'CLEAR_TRACK',
    SET_BPM: 'SET_BPM',
    SET_VISIBLE_OCTAVES: 'SET_VISIBLE_OCTAVES',
    SET_SNAP_RESOLUTION: 'SET_SNAP_RESOLUTION'
};

// --- Reducer ---
function sequenceReducer(state, action) {
    switch (action.type) {
        case ACTIONS.ADD_NOTE: {
            const { trackId, note } = action.payload;
            return {
                ...state,
                tracks: state.tracks.map(track => {
                    if (track.id === trackId) {
                        const evaluatedNotes = evaluatePolyphony([...track.notes, note]);

                        // Volume Inheritance Logic
                        const newNoteIndex = evaluatedNotes.findIndex(n => n.id === note.id);
                        if (newNoteIndex !== -1) {
                            const newNote = evaluatedNotes[newNoteIndex];

                            let precedingNote = null;
                            for (let i = 0; i < evaluatedNotes.length; i++) {
                                const n = evaluatedNotes[i];
                                if (n.id !== newNote.id && n.trackId === newNote.trackId && n.startTime <= newNote.startTime && !n.isIgnored) {
                                    if (!precedingNote || n.startTime > precedingNote.startTime) {
                                        precedingNote = n;
                                    }
                                }
                            }

                            if (precedingNote) {
                                const bpmField = newNote.trackId === 1 ? { bpm: precedingNote.bpm !== undefined ? precedingNote.bpm : 120 } : {};
                                evaluatedNotes[newNoteIndex] = { ...newNote, velocity: precedingNote.velocity, ...bpmField };
                            } else {
                                const bpmField = newNote.trackId === 1 ? { bpm: 120 } : {};
                                evaluatedNotes[newNoteIndex] = { ...newNote, velocity: 100, ...bpmField };
                            }
                        }

                        return {
                            ...track,
                            notes: evaluatedNotes
                        };
                    }
                    return track;
                })
            };
        }

        case ACTIONS.UPDATE_NOTE: {
            const { trackId, noteId, updatedFields } = action.payload;

            // Strictly clamp velocity if it is being updated
            const safeFields = { ...updatedFields };
            if (safeFields.velocity !== undefined) {
                safeFields.velocity = Math.min(127, Math.max(0, isNaN(safeFields.velocity) ? 100 : safeFields.velocity));
            }
            if (safeFields.bpm !== undefined) {
                safeFields.bpm = Math.min(255, Math.max(32, isNaN(safeFields.bpm) ? 120 : safeFields.bpm));
            }

            return {
                ...state,
                tracks: state.tracks.map(track => {
                    if (track.id === trackId) {
                        return {
                            ...track,
                            notes: evaluatePolyphony(track.notes.map(note =>
                                note.id === noteId ? { ...note, ...safeFields } : note
                            ))
                        };
                    }
                    return track;
                })
            };
        }

        case ACTIONS.DELETE_NOTE: {
            const { trackId, noteId } = action.payload;
            return {
                ...state,
                tracks: state.tracks.map(track => {
                    if (track.id === trackId) {
                        return {
                            ...track,
                            notes: evaluatePolyphony(track.notes.filter(note => note.id !== noteId))
                        };
                    }
                    return track;
                })
            };
        }

        case ACTIONS.CLEAR_TRACK: {
            const { trackId } = action.payload;
            return {
                ...state,
                tracks: state.tracks.map(track => {
                    if (track.id === trackId) {
                        return {
                            ...track,
                            notes: []
                        };
                    }
                    return track;
                })
            };
        }

        case ACTIONS.SET_BPM: {
            const rawBpm = action.payload.bpm;
            // Clamp BPM strictly to ArcheAge limits (32 to 255)
            const clampedBpm = Math.min(255, Math.max(32, isNaN(rawBpm) ? 120 : rawBpm));
            return {
                ...state,
                bpm: clampedBpm
            };
        }

        case ACTIONS.SET_VISIBLE_OCTAVES: {
            return {
                ...state,
                visibleMinOctave: action.payload.min !== undefined ? action.payload.min : state.visibleMinOctave,
                visibleMaxOctave: action.payload.max !== undefined ? action.payload.max : state.visibleMaxOctave
            };
        }

        case ACTIONS.SET_SNAP_RESOLUTION: {
            return {
                ...state,
                snapResolution: action.payload.resolution
            };
        }

        default:
            return state;
    }
}

// --- Context & Provider ---
const SequenceContext = createContext();

export function SequenceProvider({ children }) {
    const [state, dispatch] = useReducer(sequenceReducer, INITIAL_STATE);
    const [selectedNoteId, setSelectedNoteId] = useState(null);
    const [pixelsPerBeat, setPixelsPerBeat] = useState(60);

    const totalCanvasBeats = useMemo(() => {
        const notes = state.tracks[0].notes;
        if (!notes || notes.length === 0) return DEFAULT_MIN_BEATS;
        let highestNoteEndBeat = 0;
        notes.forEach(note => {
            const endBeat = note.startTime + note.duration;
            if (endBeat > highestNoteEndBeat) {
                highestNoteEndBeat = endBeat;
            }
        });
        return Math.max(DEFAULT_MIN_BEATS, Math.ceil(highestNoteEndBeat) + BUFFER_BEATS);
    }, [state.tracks]);

    const addNote = (pitch, startTime, duration, velocity = 100) => {
        // Enforce volume safety bounds on note addition
        const clampedVelocity = Math.min(127, Math.max(0, isNaN(velocity) ? 100 : velocity));
        const note = {
            id: 'note-' + Date.now() + Math.random().toString(36).substr(2, 9),
            pitch,
            startTime,
            duration,
            velocity: clampedVelocity,
            trackId: 1
        };
        dispatch({ type: ACTIONS.ADD_NOTE, payload: { trackId: 1, note } });
    };

    const updateNote = (id, updatedFields) => {
        dispatch({ type: ACTIONS.UPDATE_NOTE, payload: { trackId: 1, noteId: id, updatedFields } });
    };

    const deleteNote = (id) => {
        dispatch({ type: ACTIONS.DELETE_NOTE, payload: { trackId: 1, noteId: id } });
    };

    const clearTrack = (trackId) => {
        dispatch({ type: ACTIONS.CLEAR_TRACK, payload: { trackId } });
    };

    const setBpm = (bpm) => {
        dispatch({ type: ACTIONS.SET_BPM, payload: { bpm } });
    };

    const setVisibleOctaves = (min, max) => {
        dispatch({ type: ACTIONS.SET_VISIBLE_OCTAVES, payload: { min, max } });
    };

    const setSnapResolution = (resolution) => {
        dispatch({ type: ACTIONS.SET_SNAP_RESOLUTION, payload: { resolution } });
    };

    const value = {
        state,
        addNote,
        updateNote,
        deleteNote,
        clearTrack,
        setBpm,
        setVisibleOctaves,
        setSnapResolution,
        selectedNoteId,
        setSelectedNoteId,
        totalCanvasBeats,
        pixelsPerBeat,
        setPixelsPerBeat
    };

    return (
        <SequenceContext.Provider value={value}>
            {children}
        </SequenceContext.Provider>
    );
}

// --- Custom Hook ---
export function useSequence() {
    const context = useContext(SequenceContext);
    if (!context) {
        throw new Error('useSequence must be used within a SequenceProvider');
    }
    return context;
}
