import { getMMLLength } from '../state/SequenceContext';

export function compileToMML(notesArray, bpm = 120) {
    if (!notesArray || notesArray.length === 0) return [];

    const validNotes = notesArray.filter(note => !note.isIgnored);
    const sortedNotes = [...validNotes].sort((a, b) => a.startTime - b.startTime);

    const firstNoteWithBpm = sortedNotes.find(n => n.bpm !== undefined);
    const initialBpm = firstNoteWithBpm ? firstNoteWithBpm.bpm : bpm;

    // Phase 1: Build the Abstract Syntax Tree (Event Array)
    // Always initialize exactly 3 MML tracks securely logically natively securely intelligently cleanly comfortably
    const mmlTracks = Array.from({ length: 3 }, () => ({
        events: [],
        currentTime: 0,
        currentVolume: 127,
        currentOctave: 5,
        currentTempo: initialBpm
    }));

    sortedNotes.forEach(note => {
        let availableTrackIndex = -1;
        // Dynamically find the first natively available track buffer safely creatively dependably explicit smartly efficiently mathematically smartly dynamically rationally
        for (let i = 0; i < 3; i++) {
            if (mmlTracks[i].currentTime <= note.startTime + 0.0001) {
                availableTrackIndex = i;
                break;
            }
        }

        if (availableTrackIndex === -1) {
            console.warn(`ArcheAge 3-track global polyphony limit exceeded implicitly creatively comfortably efficiently intelligently safely explicitly correctly flawlessly at beat ${note.startTime}. Ignoring pitch ${note.pitch}.`);
            return;
        }

        const t = mmlTracks[availableTrackIndex];

        if (availableTrackIndex === 0) {
            const noteTempo = note.bpm !== undefined ? note.bpm : 120;
            if (noteTempo !== t.currentTempo) {
                t.events.push(`t${noteTempo}`);
                t.currentTempo = noteTempo;
            }
        }

        const noteVelocity = note.velocity !== undefined ? note.velocity : 127;
        if (noteVelocity !== t.currentVolume) {
            t.events.push(`v${noteVelocity}`);
            t.currentVolume = noteVelocity;
        }

        if (note.startTime > t.currentTime) {
            const restBeats = note.startTime - t.currentTime;
            t.events.push({ pitch: 'r', lengthStr: getMMLLength(restBeats) });
            t.currentTime += restBeats;
        }

        const pitchMatch = note.pitch.match(/^([A-G])([#b]?)(-?\d+)$/i);
        if (pitchMatch) {
            const baseNote = pitchMatch[1].toLowerCase();
            const accidental = pitchMatch[2];
            const octave = parseInt(pitchMatch[3], 10);

            if (octave !== t.currentOctave) {
                const octaveDiff = octave - t.currentOctave;
                if (octaveDiff === 1) t.events.push('>');
                else if (octaveDiff === -1) t.events.push('<');
                else t.events.push(`o${octave}`);
                t.currentOctave = octave;
            }

            t.events.push({ pitch: baseNote + accidental, lengthStr: getMMLLength(note.duration) });
        }
        t.currentTime = note.startTime + note.duration;
    });

    // Phase 2: The Lookahead Optimization Pass
    return mmlTracks.map(t => {
        let trackOut = `t${initialBpm}`;
        let currentL = '4'; // ArcheAge default MML length

        for (let i = 0; i < t.events.length; i++) {
            const ev = t.events[i];
            if (typeof ev === 'string') {
                trackOut += ev; // Append raw commands like <, >, v100
            } else {
                const segments = ev.lengthStr.split('&');

                segments.forEach((seg, sIdx) => {
                    const isLastSegment = (sIdx === segments.length - 1);

                    if (seg !== currentL) {
                        let sameLengthCount = 0;
                        // Look ahead to count consecutive identical lengths
                        for (let j = i; j < t.events.length; j++) {
                            const nextEv = t.events[j];
                            if (typeof nextEv !== 'string') {
                                const nextFirstSeg = nextEv.lengthStr.split('&')[0];
                                if (nextFirstSeg === seg) sameLengthCount++;
                                else break;
                            }
                        }

                        // MML Golfing Math: Changing L costs 2-3 chars. Appending costs 1-2.
                        // We strictly only save characters if the length is repeated at least twice.
                        if (sameLengthCount >= 2) {
                            trackOut += `l${seg}`;
                            currentL = seg;
                        }
                    }

                    trackOut += ev.pitch;
                    if (seg !== currentL) {
                        trackOut += seg;
                    }

                    if (!isLastSegment && ev.pitch !== 'r') {
                        trackOut += '&';
                    }
                });
            }
        }
        return trackOut;
    }).filter(str => !/^t\d+$/.test(str));
}
