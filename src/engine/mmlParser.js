const PITCH_MAP = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
};
const REVERSE_PITCH_MAP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function parseMMLToNotes(mmlString) {
    if (!mmlString) return [];

    const trackMMLs = mmlString.split(',').slice(0, 3);
    const parsedNotes = [];

    // 4 beats = whole note (length 1)
    const getBeatsFromLength = (len, isDotted) => {
        const baseBeats = 4.0 / len;
        return isDotted ? baseBeats * 1.5 : baseBeats;
    };

    trackMMLs.forEach((trackStr, index) => {
        const trackId = index + 1;
        let currentTime = 0;
        let octave = 5; // Default octave
        let volume = 127;
        let tempo = 120;
        let currentDefaultLength = 4;

        // Remove whitespace
        const mml = trackStr.replace(/\s+/g, '').toLowerCase();

        let i = 0;
        let expectingTie = false;
        let lastNoteIndex = -1;

        while (i < mml.length) {
            const char = mml[i];

            if (char === 't') {
                i++;
                let numStr = '';
                while (i < mml.length && /\d/.test(mml[i])) { numStr += mml[i]; i++; }
                if (numStr) tempo = parseInt(numStr, 10);
            }
            else if (char === 'v') {
                i++;
                let numStr = '';
                while (i < mml.length && /\d/.test(mml[i])) { numStr += mml[i]; i++; }
                if (numStr) volume = parseInt(numStr, 10);
            }
            else if (char === 'o') {
                i++;
                let numStr = '';
                while (i < mml.length && /\d/.test(mml[i])) { numStr += mml[i]; i++; }
                if (numStr) octave = parseInt(numStr, 10);
            }
            else if (char === 'l') { // Sometimes 'l' changes default length
                i++;
                let numStr = '';
                while (i < mml.length && /\d/.test(mml[i])) { numStr += mml[i]; i++; }
                if (numStr) currentDefaultLength = parseInt(numStr, 10);
                if (i < mml.length && mml[i] === '.') i++; // Consume dot if present
            }
            else if (char === '>') { i++; octave++; }
            else if (char === '<') { i++; octave--; }
            else if (char === '&') { i++; expectingTie = true; }
            else if (char === 'r') {
                i++;
                let numStr = '';
                while (i < mml.length && /\d/.test(mml[i])) { numStr += mml[i]; i++; }
                const isDotted = i < mml.length && mml[i] === '.';
                if (isDotted) i++;

                const noteLen = numStr ? parseInt(numStr, 10) : currentDefaultLength;
                const duration = getBeatsFromLength(noteLen, isDotted);
                currentTime += duration;

                expectingTie = false;
            }
            else if (/[a-g]/.test(char)) {
                let pitchName = char.toUpperCase();
                i++;

                let isSharp = false;
                let isFlat = false;

                if (i < mml.length && (mml[i] === '#' || mml[i] === '+')) { isSharp = true; i++; }
                else if (i < mml.length && (mml[i] === '-' || mml[i] === 'b')) { isFlat = true; i++; }

                let numStr = '';
                while (i < mml.length && /\d/.test(mml[i])) { numStr += mml[i]; i++; }
                const isDotted = i < mml.length && mml[i] === '.';
                if (isDotted) i++;

                const noteLen = numStr ? parseInt(numStr, 10) : currentDefaultLength;
                const duration = getBeatsFromLength(noteLen, isDotted);

                if (expectingTie && lastNoteIndex !== -1) {
                    parsedNotes[lastNoteIndex].duration += duration;
                    expectingTie = false;
                } else {
                    let pitchIndex = PITCH_MAP[pitchName];
                    if (isSharp) pitchIndex++;
                    if (isFlat) pitchIndex--;

                    let finalOctave = octave;
                    if (pitchIndex < 0) {
                        pitchIndex += 12;
                        finalOctave--;
                    } else if (pitchIndex > 11) {
                        pitchIndex -= 12;
                        finalOctave++;
                    }

                    const finalPitch = `${REVERSE_PITCH_MAP[pitchIndex]}${finalOctave}`;

                    const noteObj = {
                        id: 'note-' + Date.now() + Math.random().toString(36).substr(2, 9),
                        pitch: finalPitch,
                        startTime: currentTime,
                        duration: duration,
                        velocity: volume,
                        trackId: trackId
                    };

                    if (trackId === 1) {
                        noteObj.bpm = tempo;
                    }

                    parsedNotes.push(noteObj);
                    lastNoteIndex = parsedNotes.length - 1;
                }

                currentTime += duration;
            }
            else {
                // Ignore unknown characters like |
                i++;
            }
        }
    });

    return parsedNotes;
}
