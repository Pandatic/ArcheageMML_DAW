import React, { useEffect, useState, useRef } from 'react';
import { useSequence, getUsedOctaveRange } from './state/SequenceContext';
import { compileToMML } from './engine/mmlCompiler';
import PianoRoll from './ui/PianoRoll';
import PianoKeys from './ui/PianoKeys';
import VolumeLane from './ui/VolumeLane';
import TempoLane from './ui/TempoLane';
import { playSequence, stopSequence, setAudioTempo } from './audio/AudioPlayer';

function App() {
  const { state, selectedNoteId, updateNote, setBpm, setVisibleOctaves, setSnapResolution, totalCanvasBeats, pixelsPerBeat, setPixelsPerBeat } = useSequence();
  const [compiledMML, setCompiledMML] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy MML to Clipboard');
  const [showVolumeLane, setShowVolumeLane] = useState(false);
  const [showTempoLane, setShowTempoLane] = useState(false);
  const scrollWrapperRef = useRef(null);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.altKey) {
        e.preventDefault();
        setPixelsPerBeat(prev => Math.max(20, Math.min(240, prev - e.deltaY * 0.5)));
      }
    };
    const wrapper = scrollWrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (wrapper) {
        wrapper.removeEventListener('wheel', handleWheel);
      }
    };
  }, [setPixelsPerBeat]);

  const track1Notes = state.tracks[0].notes;
  const selectedNote = track1Notes.find(n => n.id === selectedNoteId);

  const activeTrackIds = [...new Set(track1Notes.filter(n => !n.isIgnored).map(n => n.trackId))].sort();

  const getTrackColor = (id) => {
    if (id === 1) return '#4facfe';
    if (id === 2) return '#43e97b';
    if (id === 3) return '#fa709a';
    return '#ffffff';
  };

  // Sync React BPM state to Tone.js
  useEffect(() => {
    setAudioTempo(state.bpm);
  }, [state.bpm]);

  // Rule 2: Logic Before UI
  // Import the dummy state array, run it through the compiler, and console log it
  useEffect(() => {

    console.log("--- MML Compiler Polyphony Logic Verification ---");
    console.log("Base Note Array (with chord & overlap):", track1Notes);

    // Pass the state.bpm into the Compiler
    const compiledMMLTracks = compileToMML(track1Notes, state.bpm);
    console.log("Compiled MML Output:");
    console.log("Track 1:", compiledMMLTracks[0]);
    console.log("Track 2:", compiledMMLTracks[1]);
    console.log("Track 3:", compiledMMLTracks[2]);

    // Join tracks with a comma to generate the full multi-track ArcheAge import string
    // Filter empty tracks to prevent trailing commas like string,,
    setCompiledMML(compiledMMLTracks.filter(track => track.trim() !== '').join(','));
  }, [state.bpm, track1Notes]);

  const handlePlay = () => {
    // Only pass notes from the first track based on our current data structure limit
    playSequence(state.tracks[0].notes);
  };

  const handleMinOctaveChange = (e) => {
    let newMin = parseInt(e.target.value, 10);
    let currentMax = state.visibleMaxOctave;
    const { min: usedMin } = getUsedOctaveRange(state.tracks[0].notes);

    if (usedMin !== null && newMin > usedMin) {
      newMin = usedMin; // can't hide used notes
    }

    if (newMin > currentMax) {
      currentMax = newMin; // auto adjust max
    }

    setVisibleOctaves(newMin, currentMax);
  };

  const handleMaxOctaveChange = (e) => {
    let newMax = parseInt(e.target.value, 10);
    let currentMin = state.visibleMinOctave;
    const { max: usedMax } = getUsedOctaveRange(state.tracks[0].notes);

    if (usedMax !== null && newMax < usedMax) {
      newMax = usedMax; // can't hide used notes
    }

    if (newMax < currentMin) {
      currentMin = newMax; // auto adjust min
    }

    setVisibleOctaves(currentMin, newMax);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(compiledMML).then(() => {
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus('Copy MML to Clipboard'), 2000);
    });
  };

  return (
    <div className="app-container" style={{ padding: '20px' }}>
      <h1>ArcheAge Web DAW</h1>

      {/* Global Tempo Controls */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#222', borderRadius: '4px', border: '1px solid #444' }}>
        <div>
          <label style={{ color: '#fff', marginRight: '15px', fontWeight: 'bold' }}>
            Canvas Octave Range:
          </label>
          <select value={state.visibleMinOctave} onChange={handleMinOctaveChange} style={{ marginRight: '10px', padding: '5px' }}>
            {[...Array(11)].map((_, i) => (
              <option key={`min-oct-${i}`} value={i}>Min: Octave {i}</option>
            ))}
          </select>
          <select value={state.visibleMaxOctave} onChange={handleMaxOctaveChange} style={{ padding: '5px' }}>
            {[...Array(11)].map((_, i) => (
              <option key={`max-oct-${i}`} value={i}>Max: Octave {i}</option>
            ))}
          </select>

          <label style={{ color: '#fff', marginLeft: '30px', marginRight: '15px', fontWeight: 'bold' }}>
            Grid:
          </label>
          <select
            value={state.snapResolution}
            onChange={(e) => setSnapResolution(parseFloat(e.target.value))}
            style={{ padding: '5px' }}
          >
            <option value={1.0}>1/4</option>
            <option value={0.5}>1/8</option>
            <option value={0.25}>1/16</option>
            <option value={0.125}>1/32</option>
            <option value={0.0625}>1/64</option>
          </select>

          <label style={{ color: '#fff', marginLeft: '30px', marginRight: '15px', fontWeight: 'bold' }}>
            Zoom:
          </label>
          <input
            type="range"
            min="20"
            max="240"
            value={pixelsPerBeat}
            onChange={(e) => setPixelsPerBeat(Number(e.target.value))}
            style={{ verticalAlign: 'middle' }}
          />
        </div>
      </div>

      {/* View Toggles */}
      <div style={{ marginBottom: '10px', display: 'flex', gap: '15px', alignItems: 'center' }}>
        <button
          onClick={() => setShowTempoLane(!showTempoLane)}
          style={{ padding: '8px 16px', backgroundColor: showTempoLane ? '#ffb347' : '#f0932b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}
        >
          {showTempoLane ? 'Hide Tempo Lane' : 'Show Tempo Lane'}
        </button>
        <button
          onClick={() => setShowVolumeLane(!showVolumeLane)}
          style={{ padding: '8px 16px', backgroundColor: showVolumeLane ? '#bf47ff' : '#4facfe', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}
        >
          {showVolumeLane ? 'Hide Volume Lane' : 'Show Volume Lane'}
        </button>
      </div>

      {/* Core Sequence Editor Layout Flow Constraint */}
      <div style={{ display: 'flex', flexDirection: 'row', border: '1px solid #444', backgroundColor: '#111', borderRadius: '4px', margin: '20px 0' }}>
        {/* Pillar A: Frozen Sidebar (Headers) */}
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, width: '60px', backgroundColor: '#222' }}>
          {/* Tempo Spacer mapped to match exact canvas height & margins */}
          {showTempoLane && (
            <div style={{ height: '100px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#ffb347', borderBottom: '1px solid #444' }}>
              BPM
            </div>
          )}

          <PianoKeys />

          {/* Volume Spacers mapped to match exact canvas heights & margins per lane */}
          {showVolumeLane && activeTrackIds.map(id => (
            <div key={id} style={{ height: '100px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: getTrackColor(id), borderTop: '1px solid #444', borderBottom: '1px solid #444' }}>
              Vol
            </div>
          ))}
        </div>

        {/* Pillar B: Dynamic Scrolling Wrapper mapping Timelines inherently strictly securely explicitly */}
        <div ref={scrollWrapperRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: `${totalCanvasBeats * pixelsPerBeat}px`, display: 'flex', flexDirection: 'column' }}>
            {/* Master Timeline Header */}
            {showTempoLane && <TempoLane />}

            {/* The Piano Roll UI */}
            <PianoRoll />

            {/* Volume Automation Lanes */}
            {showVolumeLane && activeTrackIds.map(id => (
              <VolumeLane key={id} trackId={id} trackColor={getTrackColor(id)} />
            ))}
          </div>
        </div>
      </div>

      {/* Pillar C: Audio Player Controls */}
      <div style={{ margin: '20px 0', display: 'flex', gap: '10px' }}>
        <button onClick={handlePlay} style={{ padding: '10px 20px', backgroundColor: '#00ddff', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          Play Sequence
        </button>
        <button onClick={stopSequence} style={{ padding: '10px 20px', backgroundColor: '#ff4444', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
          Stop
        </button>
      </div>

      {/* MML Export Output */}
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#222', borderRadius: '4px', border: '1px solid #444' }}>
        <h3 style={{ marginTop: 0, color: '#fff' }}>Export MML</h3>
        <textarea
          readOnly
          value={compiledMML}
          style={{ width: '100%', height: '60px', marginBottom: '10px', padding: '10px', backgroundColor: '#111', color: '#00ddff', border: '1px solid #555', borderRadius: '4px', resize: 'vertical', fontFamily: 'monospace' }}
        />
        <button
          onClick={handleCopy}
          style={{ padding: '10px 20px', backgroundColor: copyStatus === 'Copied!' ? '#43e97b' : '#4facfe', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}
        >
          {copyStatus}
        </button>
      </div>
    </div>
  );
}

export default App;
