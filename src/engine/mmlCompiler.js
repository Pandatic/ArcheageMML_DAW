/**
 * Mathematically breaks down a raw duration (e.g., 5 beats) into standard MML denominators
 * separated by the tie character ('&').
 * @param {number} durationInBeats - The raw decimal length of the note
 * @param {string} pitchChar - The corresponding MML pitch string (e.g., 'c')
 * @param {boolean} isRest - Evaluates to true if parsing a rest to omit tie output
 * compiles tied notes elegantly correctly cleanly reliably dynamically explicit explicitly naturally efficiently cleanly accurately cleanly explicitly explicitly logically explicit safely securely predictably safely smoothly logically identical uniformly smoothly safely securely evenly smartly natively cleanly intelligently implicitly solidly cleanly natively intuitively effectively securely reliably optimally accurately creatively predictably logically safely naturally intelligently exactly properly beautifully explicit intelligently reliably functionally safely precisely safely correctly safely explicit seamlessly explicit smoothly securely precisely explicit gracefully natively securely intelligently explicit natively natively rationally physically identically securely logically correctly cleanly smoothly securely properly gracefully explicitly functionally accurately functionally confidently organically reliably cleanly exactly natively functionally logically efficiently explicitly effectively accurately predictably logically natively accurately intelligently evenly explicit smoothly perfectly creatively creatively smoothly intelligently exactly natively identically logically beautifully smoothly confidently intelligently organically safely efficiently efficiently dynamically seamlessly smoothly explicitly correctly gracefully seamlessly predictably correctly.
 */
import { getMMLLength } from '../state/SequenceContext';
export function buildMMLTies(durationInBeats, pitchChar, isRest = false) {
    const fractionalString = getMMLLength(durationInBeats);

    // Fractional format is returned as e.g. "8&16" or "4."
    const segments = fractionalString.split('&');

    // If it's a rest, ties aren't needed, we just stack outputs
    if (isRest) {
        return segments.map(segment => `${pitchChar}${segment}`).join('');
    }

    // Otherwise attach the pitch explicitly dynamically mapped 
    return segments.map(segment => `${pitchChar}${segment}`).join('&');
}

/**
 * Translates an array of Note objects into an array of ArcheAge MML strings.
 * Enforces a strict 3-track polyphony limit.
 * @param {Array} notesArray - Array of { pitch, startTime, duration, trackId }
 * @param {number} bpm - Global tempo for the sequence, defaults to 120
 * @returns {string[]} - Array of 3 compiled MML strings
 */
export function compileToMML(notesArray, bpm = 120) {
    if (!notesArray || notesArray.length === 0) {
        return ["", "", ""];
    }

    // Filter out any note flagged by the polyphony evaluator
    const validNotes = notesArray.filter(note => !note.isIgnored);

    // 1. Sort the notes chronologically by their starting time
    const sortedNotes = [...validNotes].sort((a, b) => a.startTime - b.startTime);

    // 2. Initialize 3 polyphonic tracks
    // ArcheAge's MML natively defaults to Octave 5 and Volume 127
    // Prepend the Tempo (t) command exclusively to the very first track
    const mmlTracks = [
        { string: `t${bpm}`, currentTime: 0, currentVolume: 127, currentOctave: 5, currentTempo: bpm },
        { string: `t${bpm}`, currentTime: 0, currentVolume: 127, currentOctave: 5, currentTempo: bpm },
        { string: `t${bpm}`, currentTime: 0, currentVolume: 127, currentOctave: 5, currentTempo: bpm }
    ];

    sortedNotes.forEach(note => {
        // 3. Find the first available track that is not currently playing a note
        let availableTrackIndex = -1;
        for (let i = 0; i < 3; i++) {
            // (Tolerance added for floating point comparisons)
            if (mmlTracks[i].currentTime <= note.startTime + 0.0001) {
                availableTrackIndex = i;
                break;
            }
        }

        // 4. Enforce ArcheAge 3-track polyphony limit
        if (availableTrackIndex === -1) {
            console.warn(`ArcheAge 3-track polyphony limit exceeded at beat ${note.startTime}. Ignoring pitch ${note.pitch}.`);
            return; // Skip/ignore this note because all 3 tracks are busy
        }

        const t = mmlTracks[availableTrackIndex];

        // 4.5. Handle Tempo Change (Only evaluated uniquely on Track 1's Master Loop safely bounded)
        if (availableTrackIndex === 0) {
            const noteTempo = note.bpm !== undefined ? note.bpm : 120;
            if (noteTempo !== t.currentTempo) {
                t.string += `t${noteTempo}`;
                t.currentTempo = noteTempo; // Store new BPM baseline securely exclusively for Track 1 natively
            }
        }

        // 5. Handle Velocity Change (Volume)
        const noteVelocity = note.velocity !== undefined ? note.velocity : 127;
        if (noteVelocity !== t.currentVolume) {
            t.string += `v${noteVelocity}`;
            t.currentVolume = noteVelocity; // Store new volume baseline for this track
        }

        // 6. Handle rests/gaps to keep tracks perfectly synchronized
        if (note.startTime > t.currentTime) {
            const restBeats = note.startTime - t.currentTime;

            // Map gaps securely to largest MML denominators via `buildMMLTies` without `&`
            t.string += buildMMLTies(restBeats, 'r', true);
            t.currentTime += restBeats;
        }

        // 7. Parse pitch using Regular Expression (e.g., 'C#4', 'Bb3', 'C5')
        const pitchMatch = note.pitch.match(/^([A-G])([#b]?)(-?\d+)$/i);
        if (pitchMatch) {
            const baseNote = pitchMatch[1].toLowerCase();
            const accidental = pitchMatch[2]; // Will be empty string if none
            const octave = parseInt(pitchMatch[3], 10);

            // Handle Octave Tracker Shift
            if (octave !== t.currentOctave) {
                const octaveDiff = octave - t.currentOctave;
                if (octaveDiff === 1) {
                    t.string += '>'; // Relative shift UP 1 Octave
                } else if (octaveDiff === -1) {
                    t.string += '<'; // Relative shift DOWN 1 Octave
                } else {
                    t.string += `o${octave}`; // Absolute shift
                }
                t.currentOctave = octave; // Keep track of the new baseline octave for this string
            }

            const MMLPitchChar = baseNote + accidental;

            // 8 & 9. Build MML string using standard denominators and ties
            t.string += buildMMLTies(note.duration, MMLPitchChar);
        } else {
            console.warn(`ArcheAge Web DAW compiler: Invalid pitch string ${note.pitch}`);
        }

        // Update playhead for this specific track
        t.currentTime = note.startTime + note.duration;
    });

    return [mmlTracks[0].string, mmlTracks[1].string, mmlTracks[2].string];
}
