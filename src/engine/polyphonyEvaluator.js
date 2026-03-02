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

    // Keep track of all globally active notes to ensure ArcheAge's strict 3-note global polyphony limit
    const globalActiveNotes = [];

    for (let i = 0; i < evaluatedNotes.length; i++) {
        const note = evaluatedNotes[i];

        // 1. Clean up notes that have mathematically ended before this note begins
        for (let j = globalActiveNotes.length - 1; j >= 0; j--) {
            if (globalActiveNotes[j].endTime <= note.startTime + 0.0001) {
                globalActiveNotes.splice(j, 1);
            }
        }

        // 2. Overlap Checking Logic
        if (globalActiveNotes.length >= 3) {
            // There are already 3 notes actively playing across the entire DAW sequence.
            // This 4th note is mathematically illegal for ArcheAge's compiler.
            note.isIllegal = true;
            note.isIgnored = true;
        } else {
            // This space is free! It acts as a valid note.
            note.isIllegal = false;
            note.isIgnored = false;

            // We register this note as actively consumed
            globalActiveNotes.push({ endTime: note.startTime + note.duration });
        }
    }

    return evaluatedNotes;
}
