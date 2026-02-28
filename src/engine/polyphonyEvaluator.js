/**
 * Evaluates an array of notes and flags any that exceed the 3-track polyphony limit.
 * @param {Array} notesArray - The array of note objects
 * @returns {Array} - The evaluated array with isIgnored flags populated
 */
export function evaluatePolyphony(notesArray) {
    if (!notesArray) return [];

    // Create a copy of the objects to avoid mutating state directly
    const evaluatedNotes = notesArray.map(note => ({ ...note }));

    // Sort chronologically by start time
    evaluatedNotes.sort((a, b) => a.startTime - b.startTime);

    // Keep track of the end times and assigned trackIds of currently playing notes. Maximum 3 concurrently.
    const activeNotes = [];

    for (let i = 0; i < evaluatedNotes.length; i++) {
        const note = evaluatedNotes[i];

        // Remove notes that have finished playing before this note begins
        // A tiny epsilon (.0001) is added to handle floating point tolerance
        for (let j = activeNotes.length - 1; j >= 0; j--) {
            if (activeNotes[j].endTime <= note.startTime + 0.0001) {
                activeNotes.splice(j, 1);
            }
        }

        // Check polyphony limit (max 3 concurrent strings in ArcheAge MML)
        if (activeNotes.length >= 3) {
            // All 3 tracks are currently playing a note. This overlaps too much.
            note.isIgnored = true;
        } else {
            // We have available space. Claim a polyphony slot!
            note.isIgnored = false;

            // Find the lowest available track ID (1, 2, or 3)
            const usedTrackIds = activeNotes.map(n => n.trackId);
            let availableTrackId = 1;
            while (usedTrackIds.includes(availableTrackId)) {
                availableTrackId++;
            }

            note.trackId = availableTrackId;
            activeNotes.push({ endTime: note.startTime + note.duration, trackId: availableTrackId });
        }
    }

    // At this point, evaluatedNotes is sorted by startTime. 
    // We didn't change the IDs, so returning this sorted array is fine and healthy for our reducers.
    return evaluatedNotes;
}
