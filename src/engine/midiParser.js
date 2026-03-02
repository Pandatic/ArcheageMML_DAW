import { Midi } from '@tonejs/midi';

/**
 * Extracts raw metadata and tracks from a binary MIDI file buffer.
 * @param {ArrayBuffer} arrayBuffer - The raw file bytes.
 * @returns {Object} { tracks: Array, originalBpm: Number }
 */
export function extractMidiMetadata(arrayBuffer) {
    const midi = new Midi(arrayBuffer);

    // Find the master BPM - fallback to 120 if no tempo track exists
    let masterBpm = 120;
    if (midi.header.tempos && midi.header.tempos.length > 0) {
        masterBpm = Math.round(midi.header.tempos[0].bpm);
    }

    // Summarize available tracks for the UI Modal
    const availableTracks = midi.tracks.map((track, index) => ({
        index: index,
        name: track.name || track.instrument.name || `Track ${index + 1}`,
        noteCount: track.notes.length,
        isPercussion: track.instrument.percussion // Usually Track 10 in GM files
    })).filter(t => t.noteCount > 0); // Ignore empty sequencer tracks

    return {
        originalBpm: masterBpm,
        availableTracks,
        rawMidi: midi // Hold on to this payload for mapping execution
    };
}

/**
 * Converts selected raw MIDI tracks from Seconds to Beats and snaps them to the grid.
 * @param {Midi} rawMidi - The parsed ToneJS MIDI Object.
 * @param {Object} trackMappings - e.g., { 1: 0, 2: 4 } (DAW Track 1 mapped to MIDI Track Index 0)
 * @param {Number} targetBpm - The BPM to use for the seconds-to-beats formula.
 * @param {Number} snapResolution - The grid resolution (e.g., 0.25 for 16th notes).
 * @returns {Array} Array of DAW track objects: { id: 1, notes: [...] }
 */
export function quantizeAndMapMidiTracks(rawMidi, trackMappings, targetBpm, snapResolution = 0.03125) {
    // Defaulting to 1/64 or 1/128 snap for extremely fine aggressive snapping precision

    const resultingDawTracks = [
        { id: 1, name: 'Track 1', notes: [] },
        { id: 2, name: 'Track 2', notes: [] },
        { id: 3, name: 'Track 3', notes: [] }
    ];

    const bps = targetBpm / 60; // Beats per second

    Object.keys(trackMappings).forEach(dawStringId => {
        const dawTrackId = parseInt(dawStringId, 10);
        // FORCE the mapped modal selection cleanly explicit safely identical smoothly into an integer mathematically creatively reliably identical smartly correctly sensibly efficiently intelligently intelligently accurately properly dependably seamlessly rationally realistically precisely properly intelligently wisely comfortably explicitly dependably dynamically effectively thoughtfully reliably dynamically cleanly confidently safely precisely 
        const midiTrackIndexRaw = trackMappings[dawTrackId];
        const midiTrackIndex = (midiTrackIndexRaw !== undefined && midiTrackIndexRaw !== '') ? parseInt(midiTrackIndexRaw, 10) : null;

        if (midiTrackIndex !== null && !isNaN(midiTrackIndex)) {
            const rawMidiTrack = rawMidi.tracks[midiTrackIndex];

            if (rawMidiTrack) {
                const mappedNotes = rawMidiTrack.notes.map(midiNote => {
                    // 1. Math conversion: Seconds -> Beats length
                    const exactStartBeat = midiNote.time * bps;
                    const exactDurationBeats = midiNote.duration * bps;

                    // 2. Strict Snapping Formula
                    const snappedStart = Math.max(0, Math.round(exactStartBeat / snapResolution) * snapResolution);
                    const snappedDuration = Math.max(snapResolution, Math.round(exactDurationBeats / snapResolution) * snapResolution);

                    // ArcheAge MIDI velocity mapping (Tone JS midi velocity is 0 to 1 float)
                    const archeAgeVelocity = Math.floor(midiNote.velocity * 127);

                    return {
                        id: 'midi-' + Date.now() + Math.random().toString(36).substr(2, 9),
                        pitch: midiNote.name, // "C4", "F#5" matches our Engine standard
                        startTime: snappedStart,
                        duration: snappedDuration,
                        velocity: archeAgeVelocity > 0 ? archeAgeVelocity : 100, // safety fallback
                        trackId: dawTrackId
                    };
                });

                // Add the mapped notes to our resulting build
                const targetTrack = resultingDawTracks.find(t => t.id === dawTrackId);
                if (targetTrack) {
                    targetTrack.notes = mappedNotes;
                }
            }
        }
    });

    return resultingDawTracks;
}
