import React, { useEffect, useState, useRef } from 'react';
import { useSequence, getUsedOctaveRange, MAX_CANVAS_WIDTH } from './state/SequenceContext';
import { compileToMML } from './engine/mmlCompiler';
import PianoRoll from './ui/PianoRoll';
import PianoKeys from './ui/PianoKeys';
import VolumeLane from './ui/VolumeLane';
import TempoLane from './ui/TempoLane';
import { syncTransport, playAudio, pauseAudio, stopAudio, skipBars, setAudioTempo, loadInstrument, isTransportPlaying, getCurrentBeat, seekToBeat } from './audio/AudioPlayer';

const getArtistryRank = (charCount) => {
  if (charCount <= 200) return { rank: 'Amateur', max: 200, color: '#b8906f' };
  if (charCount <= 400) return { rank: 'Novice', max: 400, color: '#67b93e' };
  if (charCount <= 600) return { rank: 'Veteran', max: 600, color: '#4790d0' };
  if (charCount <= 800) return { rank: 'Expert', max: 800, color: '#b446c8' };
  if (charCount <= 1000) return { rank: 'Master', max: 1000, color: '#e09b2d' };
  if (charCount <= 1200) return { rank: 'Authority', max: 1200, color: '#d36440' };
  if (charCount <= 1400) return { rank: 'Champion', max: 1400, color: '#d36440' };
  if (charCount <= 1600) return { rank: 'Adept', max: 1600, color: '#d36440' };
  if (charCount <= 1800) return { rank: 'Herald', max: 1800, color: '#d36440' };
  if (charCount <= 5000) return { rank: 'Virtuoso', max: 5000, color: '#d36440' };
  if (charCount <= 7000) return { rank: 'Celebrity', max: 7000, color: '#d34040' };
  if (charCount <= 10000) return { rank: 'Famed', max: 10000, color: '#9e9e9e' };
  return { rank: 'Exceeds Limits', max: 10000, color: '#ff0000' };
};

function App() {
  const { state, selectedNoteIds, setSelectedNoteIds, updateNote, setBpm, setVisibleOctaves, setSnapResolution, totalCanvasBeats, pixelsPerBeat, setPixelsPerBeat, loadProject, loadMML, setInstrument, addMultipleNotes, setClipboard, trimSilence, toggleMute, toggleSolo } = useSequence();
  const [compiledMML, setCompiledMML] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy MML to Clipboard');
  const [showVolumeLane, setShowVolumeLane] = useState(false);
  const [showTempoLane, setShowTempoLane] = useState(false);
  const [isInstrumentLoading, setIsInstrumentLoading] = useState(false);
  const scrollWrapperRef = useRef(null);

  useEffect(() => {
    setIsInstrumentLoading(true);
    loadInstrument(state.instrument).then(() => {
      setIsInstrumentLoading(false);
    });
  }, [state.instrument]);

  useEffect(() => {
    const handleWheel = (e) => {
      if (e.altKey) {
        e.preventDefault();
        const maxSafeZoom = Math.min(240, Math.floor(MAX_CANVAS_WIDTH / totalCanvasBeats));
        setPixelsPerBeat(prev => Math.max(20, Math.min(maxSafeZoom, prev - e.deltaY * 0.5)));
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

  useEffect(() => {
    let animationFrameId;

    const trackScroll = () => {
      if (isTransportPlaying() && scrollWrapperRef.current) {
        const wrapper = scrollWrapperRef.current;
        const currentBeat = getCurrentBeat();
        const playheadX = currentBeat * pixelsPerBeat;

        const viewLeft = wrapper.scrollLeft;
        const viewRight = viewLeft + wrapper.clientWidth;

        // If playhead goes off the right edge (with 20px padding)
        if (playheadX > viewRight - 20) {
          // "Turn the page": snap scroll so playhead is near the left edge
          wrapper.scrollLeft = playheadX - 50;
        }
        // If user skips backwards off the left edge
        else if (playheadX < viewLeft) {
          wrapper.scrollLeft = Math.max(0, playheadX - 50);
        }
      }
      animationFrameId = requestAnimationFrame(trackScroll);
    };

    trackScroll();

    return () => cancelAnimationFrame(animationFrameId);
  }, [pixelsPerBeat]);

  const handleTogglePlayback = () => {
    if (isTransportPlaying()) {
      pauseAudio();
    } else {
      const anySolo = state.tracks.some(t => t.isSoloed);
      const notesToPlay = state.tracks[0].notes.filter(n => {
        const trackDef = state.tracks.find(t => t.id === n.trackId);
        if (!trackDef) return true;
        if (anySolo) return trackDef.isSoloed;
        return !trackDef.isMuted;
      });
      syncTransport(notesToPlay);
      playAudio();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlayback();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const currentBeat = getCurrentBeat();
        // Subtract a tiny epsilon to ensure we snap to the *previous* line if we are exactly on a line
        let newBeat = Math.floor((currentBeat - 0.001) / state.snapResolution) * state.snapResolution;
        if (newBeat < 0) newBeat = 0;
        seekToBeat(newBeat);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const currentBeat = getCurrentBeat();
        // Add a tiny epsilon to ensure we snap to the *next* line
        let newBeat = Math.ceil((currentBeat + 0.001) / state.snapResolution) * state.snapResolution;
        seekToBeat(newBeat);
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
        e.preventDefault();
        const copiedNotes = state.tracks[0].notes.filter(n => state.selectedNoteIds && state.selectedNoteIds.includes(n.id) || selectedNoteIds.includes(n.id));
        if (copiedNotes.length === 0) return;

        const minStartTime = Math.min(...copiedNotes.map(n => n.startTime));
        setClipboard({ originalStart: minStartTime, notes: copiedNotes });

      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
        e.preventDefault();
        if (!state.clipboard || !state.clipboard.notes || state.clipboard.notes.length === 0) return;

        const currentBeat = getCurrentBeat();
        const snappedStart = Math.round(currentBeat / state.snapResolution) * state.snapResolution;

        const newNotesArray = state.clipboard.notes.map(note => {
          const newStartTime = snappedStart + (note.startTime - state.clipboard.originalStart);
          return {
            ...note,
            id: 'note-' + Date.now() + Math.random().toString(36).substr(2, 9),
            startTime: newStartTime
          };
        });

        addMultipleNotes(newNotesArray);
        setSelectedNoteIds(newNotesArray.map(n => n.id));
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.tracks, state.snapResolution, state.clipboard, selectedNoteIds]);

  // Auto-zoom out if the song length exceeds the maximum canvas width
  useEffect(() => {
    const currentWidth = totalCanvasBeats * pixelsPerBeat;
    if (currentWidth > MAX_CANVAS_WIDTH) {
      const safeZoom = Math.floor(MAX_CANVAS_WIDTH / totalCanvasBeats);
      // Ensure it doesn't zoom out past a minimum readable threshold (e.g., 10px per beat)
      setPixelsPerBeat(Math.max(10, safeZoom));
    }
  }, [totalCanvasBeats, pixelsPerBeat, setPixelsPerBeat]); // Only trigger when the song length changes

  const track1Notes = state.tracks[0].notes;
  const selectedNote = track1Notes.find(n => selectedNoteIds.includes(n.id));

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

  const handleSaveProject = () => {
    const data = JSON.stringify({ tracks: state.tracks, bpm: state.bpm });
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'archeage_project.json';
    a.click();
  };

  const handleLoadProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsedData = JSON.parse(event.target.result);
        loadProject(parsedData);
      } catch (err) {
        console.error("Failed to load project", err);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        loadMML(event.target.result);
      } catch (err) {
        console.error("Failed to parse MML", err);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleDownloadMML = () => {
    const blob = new Blob([compiledMML], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'archeage_song.txt';
    a.click();
  };

  const rankInfo = getArtistryRank(compiledMML.length);

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-main, #111)', color: 'var(--text-main, #fff)', overflow: 'hidden' }}>
      {/* Top Toolbar Ribbon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-toolbar, #222)', padding: '10px 20px', borderBottom: '1px solid var(--border-color, #444)', flexShrink: 0 }}>

        {/* Left Zone: Menus & Transport */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* File / Actions Group */}
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={handleSaveProject} style={{ padding: '6px 12px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}>Save</button>
            <label style={{ padding: '6px 12px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}>
              Load
              <input type="file" accept=".json" onChange={handleLoadProject} style={{ display: 'none' }} />
            </label>
            <button onClick={() => document.getElementById('mml-upload').click()} style={{ padding: '6px 12px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}>Import .txt</button>
            <input type="file" accept=".txt" id="mml-upload" style={{ display: 'none' }} onChange={handleFileUpload} />
            <button onClick={trimSilence} style={{ padding: '6px 12px', backgroundColor: '#e09b2d', color: '#fff', border: '1px solid #555', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}>Trim</button>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: '#555' }} /> {/* Divider */}

          {/* View Toggles */}
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={() => setShowTempoLane(!showTempoLane)} style={{ padding: '6px 12px', backgroundColor: showTempoLane ? '#ffb347' : '#333', color: showTempoLane ? '#000' : '#fff', border: '1px solid #555', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}>Tempo</button>
            <button onClick={() => setShowVolumeLane(!showVolumeLane)} style={{ padding: '6px 12px', backgroundColor: showVolumeLane ? '#bf47ff' : '#333', color: showVolumeLane ? '#fff' : '#fff', border: '1px solid #555', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}>Volume</button>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: '#555' }} /> {/* Divider */}

          {/* Transport Controls */}
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={stopAudio} style={{ padding: '6px 12px', backgroundColor: '#555', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>|&lt;</button>
            <button onClick={() => skipBars(-1)} style={{ padding: '6px 12px', backgroundColor: '#555', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>&lt;&lt;</button>
            <button onClick={handleTogglePlayback} style={{ padding: '6px 16px', backgroundColor: '#00ddff', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}>Play / Pause</button>
            <button onClick={stopAudio} style={{ padding: '6px 12px', backgroundColor: '#ff4444', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>Stop</button>
            <button onClick={() => skipBars(1)} style={{ padding: '6px 12px', backgroundColor: '#555', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>&gt;&gt;</button>
          </div>
        </div>

        {/* Right Zone: Tools & Instrument */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label>Octaves:</label>
            <select value={state.visibleMinOctave} onChange={handleMinOctaveChange} style={{ padding: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px' }}>
              {[...Array(11)].map((_, i) => <option key={`min-${i}`} value={i}>{i}</option>)}
            </select>
            <span>-</span>
            <select value={state.visibleMaxOctave} onChange={handleMaxOctaveChange} style={{ padding: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px' }}>
              {[...Array(11)].map((_, i) => <option key={`max-${i}`} value={i}>{i}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label>Grid:</label>
            <select value={state.snapResolution} onChange={(e) => setSnapResolution(parseFloat(e.target.value))} style={{ padding: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px' }}>
              <option value={1.0}>1/4</option><option value={0.5}>1/8</option><option value={0.25}>1/16</option><option value={0.125}>1/32</option><option value={0.0625}>1/64</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <label>Zoom:</label>
            <input type="range" min="20" max={Math.min(240, Math.floor(MAX_CANVAS_WIDTH / totalCanvasBeats))} value={pixelsPerBeat} onChange={(e) => setPixelsPerBeat(Number(e.target.value))} style={{ width: '80px' }} />
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: '#555' }} /> {/* Divider */}

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <select value={state.instrument} onChange={(e) => setInstrument(e.target.value)} style={{ padding: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px' }}>
              <option value="Piano">Piano</option><option value="Lute">Lute</option>
            </select>
            {isInstrumentLoading && <span style={{ color: '#ffb347', fontStyle: 'italic' }}>Loading...</span>}
          </div>
        </div>
      </div>

      {/* Core Sequence Editor Layout */}
      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, backgroundColor: 'var(--bg-main, #111)', overflow: 'hidden' }}>
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
          {showVolumeLane && activeTrackIds.map(id => {
            const trackDef = state.tracks.find(t => t.id === id) || {};
            return (
              <div key={id} style={{ height: '100px', marginTop: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: getTrackColor(id), borderTop: '1px solid #444', borderBottom: '1px solid #444', gap: '5px' }}>
                Vol {id}
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => toggleMute(id)} style={{ padding: '2px 5px', fontSize: '10px', backgroundColor: trackDef.isMuted ? '#ff4444' : '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>M</button>
                  <button onClick={() => toggleSolo(id)} style={{ padding: '2px 5px', fontSize: '10px', backgroundColor: trackDef.isSoloed ? '#ffb347' : '#333', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>S</button>
                </div>
              </div>
            )
          })}

          {/* Dummy Scrollbar Spacer identically mimicking natively */}
          <div style={{ height: '17px', flexShrink: 0 }} />
        </div>

        {/* Pillar B: Dynamic Scrolling Wrapper mapping Timelines inherently strictly securely explicitly */}
        <div ref={scrollWrapperRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: `${Math.min(totalCanvasBeats * pixelsPerBeat, MAX_CANVAS_WIDTH)}px`, display: 'flex', flexDirection: 'column' }}>
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



      {/* MML Export Output */}
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#222', borderRadius: '4px', border: '1px solid #444' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, color: '#fff' }}>Export MML</h3>
          <div style={{ fontSize: '14px', fontWeight: 'bold', backgroundColor: '#111', padding: '6px 12px', borderRadius: '4px', border: '1px solid #333' }}>
            <span style={{ color: '#aaa' }}>Characters: {compiledMML.length} / {rankInfo.max} </span>
            <span style={{ color: '#444', margin: '0 10px' }}>|</span>
            <span style={{ color: '#aaa' }}>Required Artistry: </span>
            <span style={{ color: rankInfo.color }}>{rankInfo.rank}</span>
          </div>
        </div>
        <textarea
          readOnly
          value={compiledMML}
          style={{ width: '100%', height: '60px', marginBottom: '10px', padding: '10px', backgroundColor: '#111', color: '#00ddff', border: '1px solid #555', borderRadius: '4px', resize: 'vertical', fontFamily: 'monospace' }}
        />
        <button
          onClick={handleCopy}
          style={{ padding: '10px 20px', backgroundColor: copyStatus === 'Copied!' ? '#43e97b' : '#4facfe', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px', marginRight: '10px' }}
        >
          {copyStatus}
        </button>
        <button
          onClick={handleDownloadMML}
          style={{ padding: '10px 20px', backgroundColor: '#bf47ff', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}
        >
          Download .txt
        </button>
      </div>
    </div>
  );
}

export default App;
