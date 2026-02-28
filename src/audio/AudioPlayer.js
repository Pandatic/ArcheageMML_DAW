import * as Tone from 'tone';

// Initialize a standard PolySynth and connect it to the main output (speakers)
const synth = new Tone.PolySynth().toDestination();

/**
 * Plays a sequence of notes utilizing Tone.js Transport
 * @param {Array} notesArray - The array of note objects from SequenceContext
 */
export async function playSequence(notesArray) {
    if (!notesArray || notesArray.length === 0) return;

    // Must call Tone.start() before playing audio in a browser environment
    await Tone.start();

    // Clear any existing scheduled events from time 0 to prevent overlapping playback
    Tone.Transport.cancel(0);

    // Filter out notes ignored by the Polyphony Evaluator so they do not attempt to play
    const validNotes = notesArray.filter(note => !note.isIgnored);

    // Map through the array and schedule each note
    validNotes.forEach(note => {
        // Translate our state's 'beats' (quarter notes) into Tone.js absolute transport ticks
        // Tone.Transport.PPQ is Pulses Per Quarter note (defaults to 192).
        const startTicks = Math.round(note.startTime * Tone.Transport.PPQ) + "i";
        const durationTicks = Math.round(note.duration * Tone.Transport.PPQ) + "i";

        // Console log for timing math verification
        console.log(`Scheduling ${note.pitch} at time: ${startTicks} for duration: ${durationTicks}`);

        Tone.Transport.schedule((time) => {
            // Trigger the attack and release of the synth
            // ArcheAge velocity operates 0-127. Tone.js accepts 0.0 - 1.0.
            const toneVelocity = (note.velocity !== undefined ? note.velocity : 100) / 127;
            synth.triggerAttackRelease(note.pitch, durationTicks, time, toneVelocity);
        }, startTicks);
    });

    // Reset and Start the transport timeline from the beginning
    Tone.Transport.stop();
    Tone.Transport.start();
}

/**
 * Stops playback immediately
 */
export function stopSequence() {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
    synth.releaseAll();
}

/**
 * Returns the current playhead position mathematically converted to fractional beats.
 * We calculate the exact current beat using Tone's seconds and Tone's BPM clock.
 * @returns {number} Current beat
 */
export function getCurrentBeat() {
    return Tone.Transport.seconds * (Tone.Transport.bpm.value / 60);
}

/**
 * Updates the global Tone.js tempo for playback
 * @param {number} newBpm - The new BPM value
 */
export function setAudioTempo(newBpm) {
    Tone.Transport.bpm.value = newBpm;
}

/**
 * Returns true if the Tone.js transport timeline is actively moving
 * @returns {boolean}
 */
export function isTransportPlaying() {
    return Tone.Transport.state === "started";
}
