import * as Tone from 'tone';

export function initAudioEngine() {
    return {
        'Piano': {
            urls: {
                'A0': 'A0.mp3', 'C1': 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3', 'A1': 'A1.mp3', 'C2': 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3', 'A2': 'A2.mp3', 'C3': 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3', 'A3': 'A3.mp3', 'C4': 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', 'A4': 'A4.mp3', 'C5': 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3', 'A5': 'A5.mp3', 'C6': 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3', 'A6': 'A6.mp3', 'C7': 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3', 'A7': 'A7.mp3', 'C8': 'C8.mp3'
            },
            baseUrl: 'https://tonejs.github.io/audio/salamander/'
        },
        'Lute': {
            urls: {
                'A1': 'A1.mp3',
                'C2': 'C2.mp3',
                'E2': 'E2.mp3',
                'A2': 'A2.mp3'
            },
            baseUrl: 'https://tonejs.github.io/audio/casio/'
        }
    };
}

let currentSampler = null;

export function loadInstrument(instrumentName) {
    return new Promise((resolve) => {
        if (currentSampler) {
            currentSampler.dispose();
            currentSampler = null;
        }

        const maps = initAudioEngine();
        const config = maps[instrumentName] || maps['Piano'];

        currentSampler = new Tone.Sampler({
            urls: config.urls,
            baseUrl: config.baseUrl,
            onload: () => {
                resolve();
            }
        }).toDestination();
    });
}

/**
 * Synchronizes the sequence of notes utilizing Tone.js Transport
 * @param {Array} notesArray - The array of note objects from SequenceContext
 */
export async function syncTransport(notesArray) {
    if (!notesArray || notesArray.length === 0) return;

    // Must call Tone.start() before playing audio in a browser environment
    await Tone.start();

    // Clear any existing scheduled events from time 0 to prevent overlapping playback
    Tone.Transport.cancel(0);

    // Filter out notes ignored by the Polyphony Evaluator so they do not attempt to play
    const validNotes = notesArray.filter(note => !note.isIgnored);

    const track1Notes = validNotes.filter(n => n.trackId === 1);

    track1Notes.forEach(note => {
        if (note.bpm !== undefined) {
            const startTicks = Math.round(note.startTime * Tone.Transport.PPQ) + "i";
            Tone.Transport.schedule((time) => {
                Tone.Transport.bpm.setValueAtTime(note.bpm, time);
            }, startTicks);
        }
    });

    let lastNoteEnd = 0;

    // Map through the array and schedule each note
    validNotes.forEach(note => {
        const startTicks = Math.round(note.startTime * Tone.Transport.PPQ) + "i";
        const durationTicks = Math.round(note.duration * Tone.Transport.PPQ) + "i";

        const endBeat = note.startTime + note.duration;
        if (endBeat > lastNoteEnd) lastNoteEnd = endBeat;

        // Console log for timing math verification
        // console.log(`Scheduling ${note.pitch} at time: ${startTicks} for duration: ${durationTicks}`);

        Tone.Transport.schedule((time) => {
            // Trigger the attack and release of the sampler
            // ArcheAge velocity operates 0-127. Tone.js accepts 0.0 - 1.0.
            const toneVelocity = (note.velocity !== undefined ? note.velocity : 100) / 127;
            if (currentSampler) {
                currentSampler.triggerAttackRelease(note.pitch, durationTicks, time, toneVelocity);
            }
        }, startTicks);
    });

    if (lastNoteEnd > 0) {
        Tone.Transport.scheduleOnce(() => {
            stopAudio();
        }, Math.round(lastNoteEnd * Tone.Transport.PPQ) + "i");
    }
}

export function playAudio() {
    Tone.Transport.start();
}

export function pauseAudio() {
    Tone.Transport.pause();
}

export function stopAudio() {
    Tone.Transport.stop();
    Tone.Transport.ticks = 0;
    if (currentSampler) {
        currentSampler.releaseAll();
    }
}

export function seekToBeat(beat) {
    Tone.Transport.ticks = beat * Tone.Transport.PPQ;
}

export function skipBars(bars) {
    const ticks = bars * 4 * Tone.Transport.PPQ;
    const current = Tone.Transport.ticks;
    Tone.Transport.ticks = Math.max(0, current + ticks);
}

/**
 * Returns the current playhead position mathematically converted to fractional beats.
 * We calculate the exact current beat using Tone's seconds and Tone's BPM clock.
 * @returns {number} Current beat
 */
export function getCurrentBeat() {
    return Tone.Transport.ticks / Tone.Transport.PPQ;
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
