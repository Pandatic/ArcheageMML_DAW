/**
 * Evaluates an array of notes, assigns them to one of 3 ArcheAge tracks, 
 * and flags any that exceed the 3-track polyphony limit.
 * @param {Array} notesArray - The array of note objects
 * @returns {Array} - The evaluated array with trackId and isIgnored flags populated
 */
export function evaluatePolyphony(notesArray) {
    if (!notesArray) return [];

    // Create a copy of the objects to avoid mutating state directly
    const evaluatedNotes = notesArray.map(note => ({ ...note }));

    // Sort chronologically by start time, and then by pitch (highest to lowest) for consistent chord assignment
    evaluatedNotes.sort((a, b) => {
        if (a.startTime === b.startTime) {
            // Give higher pitches priority for Track 1 (Melody)
            const pitchA = parseInt(a.pitch.match(/\d+/)?.[0] || 0) * 12 + a.pitch.charCodeAt(0);
            const pitchB = parseInt(b.pitch.match(/\d+/)?.[0] || 0) * 12 + b.pitch.charCodeAt(0);
            return pitchB - pitchA;
        }
        return a.startTime - b.startTime;
    });

    // Track the exact end time of the notes currently occupying each of the 3 ArcheAge lanes
    const trackEndTimes = { 1: 0, 2: 0, 3: 0 };

    for (let i = 0; i < evaluatedNotes.length; i++) {
        const note = evaluatedNotes[i];
        let assignedTrack = null;

        // 1. Find the first available track lane (1, 2, or 3)
        for (let t = 1; t <= 3; t++) {
            // We add a tiny 0.0001 epsilon to prevent microscopic floating point overlap collisions
            if (trackEndTimes[t] <= note.startTime + 0.0001) {
                assignedTrack = t;
                break;
            }
        }

        // 2. Overlap Checking & Lane Assignment
        if (assignedTrack === null) {
            // All 3 tracks are currently busy! This 4th note is mathematically illegal.
            note.isIllegal = true;
            note.isIgnored = true;
        } else {
            // This lane is free! Assign the note to it.
            note.isIllegal = false;
            note.isIgnored = false;
            note.trackId = assignedTrack; // This tells the Piano Roll to color it Blue, Green, or Purple

            // Register this lane as occupied until the note finishes playing
            trackEndTimes[assignedTrack] = note.startTime + note.duration;
        }
    }

    return evaluatedNotes;
}
