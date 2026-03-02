import React, { useEffect, useState, useRef } from 'react';
import { useSequence, getUsedOctaveRange, MAX_CANVAS_WIDTH } from './state/SequenceContext';
import { compileToMML } from './engine/mmlCompiler';
import PianoRoll from './ui/PianoRoll';
import PianoKeys from './ui/PianoKeys';
import VolumeLane from './ui/VolumeLane';
import TempoLane from './ui/TempoLane';
import { extractMidiMetadata, quantizeAndMapMidiTracks } from './engine/midiParser';
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
  const { state, selectedNoteIds, setSelectedNoteIds, updateNote, setBpm, setVisibleOctaves, setSnapResolution, totalCanvasBeats, pixelsPerBeat, setPixelsPerBeat, loadProject, loadMML, setInstrument, addMultipleNotes, setClipboard, trimSilence, toggleMute, toggleSolo, loadMidiData } = useSequence();
  const [compiledMML, setCompiledMML] = useState('');
  const [copyStatus, setCopyStatus] = useState('Copy MML to Clipboard');
  const [showVolumeLane, setShowVolumeLane] = useState(false);
  const [showTempoLane, setShowTempoLane] = useState(false);
  const [isInstrumentLoading, setIsInstrumentLoading] = useState(false);
  const [showMMLModal, setShowMMLModal] = useState(false);
  const [showMidiModal, setShowMidiModal] = useState(false);
  const [midiData, setMidiData] = useState(null);
  const [midiTrackMappings, setMidiTrackMappings] = useState({ 1: '', 2: '', 3: '' });
  const [theme, setTheme] = useState('midnight');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const scrollWrapperRef = useRef(null);

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    setIsInstrumentLoading(true);
    loadInstrument(state.instrument).then(() => {
      setIsInstrumentLoading(false);
    });
  }, [state.instrument]);

  useEffect(() => {
    const handleResize = () => {
      // Trigger a re-render to update canvas widths intelligently natively comfortably dependably optimally seamlessly thoughtfully creatively reliably implicitly reliably correctly stably predictably properly mapping dependably creatively
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const autoAdjustOctaves = (notes) => {
    if (!notes || notes.length === 0) return;
    const octaves = notes.map(n => parseInt(n.pitch.match(/\d+$/)[0], 10));
    const minO = Math.max(0, Math.min(...octaves));
    const maxO = Math.min(10, Math.max(...octaves));
    setVisibleOctaves(minO, maxO);
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
        if (parsedData.tracks?.[0]?.notes) autoAdjustOctaves(parsedData.tracks[0].notes);
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

    if (file.name.toLowerCase().endsWith('.mid') || file.name.toLowerCase().endsWith('.midi')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const extractedData = extractMidiMetadata(event.target.result);
          setMidiData(extractedData);
          setMidiTrackMappings({ 1: '', 2: '', 3: '' });
          setShowMidiModal(true);
        } catch (err) {
          console.error("Failed to parse MIDI", err);
          alert("Invalid or Corrupt MIDI File");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Standard text MML Loader efficiently identically elegantly safely explicitly predictably
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const newNotes = loadMML(event.target.result);
          if (newNotes) autoAdjustOctaves(newNotes);
        } catch (err) {
          console.error("Failed to parse MML", err);
        }
      };
      reader.readAsText(file);
    }

    e.target.value = null;
  };

  const executeMidiImport = () => {
    if (!midiData) return;
    const mappedTracks = quantizeAndMapMidiTracks(midiData.rawMidi, midiTrackMappings, midiData.originalBpm);
    loadMidiData(mappedTracks, midiData.originalBpm);

    if (mappedTracks && mappedTracks[0] && mappedTracks[0].notes) {
      setTimeout(() => autoAdjustOctaves(mappedTracks[0].notes), 100);
    }

    setShowMidiModal(false);
    setMidiData(null);
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
            <button onClick={() => document.getElementById('mml-upload').click()} style={{ padding: '6px 12px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}>Import</button>
            <input type="file" accept=".txt,.mid,.midi" id="mml-upload" style={{ display: 'none' }} onChange={handleFileUpload} />
            <button onClick={trimSilence} style={{ padding: '6px 12px', backgroundColor: '#e09b2d', color: '#fff', border: '1px solid #555', cursor: 'pointer', borderRadius: '4px', fontSize: '12px' }}>Trim</button>
            <button onClick={() => setShowMMLModal(true)} style={{ padding: '6px 12px', backgroundColor: '#4facfe', color: '#000', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', marginLeft: '10px' }}>Export MML</button>
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

        {/* Right Zone: Tools, Instrument & Live Stats */}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <select value={state.instrument} onChange={(e) => setInstrument(e.target.value)} style={{ padding: '4px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '3px' }}>
              <option value="Piano">Piano</option><option value="Lute">Lute</option>
            </select>
            {isInstrumentLoading && <span style={{ color: '#ffb347', fontStyle: 'italic' }}>Loading...</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{ padding: '4px', backgroundColor: 'var(--btn-bg, #333)', color: 'var(--text-main, #fff)', border: '1px solid var(--border-color, #555)', borderRadius: '3px' }}>
              <option value="midnight">Midnight</option>
              <option value="classic">ArcheAge</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div style={{ width: '1px', height: '20px', backgroundColor: '#555' }} /> {/* Divider */}

          {/* Live Stats display replacing the bottom stats bar */}
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#111', padding: '4px 10px', borderRadius: '4px', border: '1px solid #333' }}>
            <span style={{ color: '#aaa' }}>Chars: {compiledMML.length}/{rankInfo.max} </span>
            <span style={{ color: '#444', margin: '0 8px' }}>|</span>
            <span style={{ color: rankInfo.color }}>{rankInfo.rank}</span>
          </div>
        </div>
      </div>

      {/* Core Sequence Editor Layout */}
      <div ref={scrollWrapperRef} style={{ display: 'flex', flexDirection: 'row', flex: 1, backgroundColor: 'var(--bg-main, #111)', overflow: 'auto', alignItems: 'flex-start' }}>
        {/* Pillar A: Frozen Sidebar (Headers) */}
        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0, width: '60px', backgroundColor: '#222', position: 'sticky', left: 0, zIndex: 10 }}>
          {/* Tempo Spacer mapped to match exact canvas height & margins */}
          {showTempoLane && (
            <div style={{ height: '100px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#ffb347', borderBottom: '1px solid #444' }}>
              BPM
            </div>
          )}

          <PianoKeys octaveRange={{ min: state.visibleMinOctave, max: state.visibleMaxOctave }} />

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
        </div>

        {/* Pillar B: Master Timelines natively mapped flawlessly */}
        <div style={{ width: `${Math.min(totalCanvasBeats * pixelsPerBeat, MAX_CANVAS_WIDTH)}px`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          {/* Master Timeline Header */}
          {showTempoLane && <TempoLane />}

          {/* The Piano Roll UI */}
          <PianoRoll octaveRange={{ min: state.visibleMinOctave, max: state.visibleMaxOctave }} />

          {/* Volume Automation Lanes */}
          {showVolumeLane && activeTrackIds.map(id => (
            <VolumeLane key={id} trackId={id} trackColor={getTrackColor(id)} />
          ))}
        </div>
      </div>



      {/* Modal Overlay for Exporting MML */}
      {showMMLModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: '600px', backgroundColor: 'var(--bg-toolbar, #222)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color, #444)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, color: 'var(--text-main, #fff)', fontSize: '18px' }}>Export MML</h2>
              <button onClick={() => setShowMMLModal(false)} style={{ backgroundColor: 'transparent', border: 'none', color: 'var(--text-muted, #aaa)', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
            </div>
            <textarea
              readOnly
              value={compiledMML}
              style={{ width: '100%', height: '150px', marginBottom: '15px', padding: '10px', backgroundColor: 'var(--bg-main, #111)', color: 'var(--text-main, #00ddff)', border: '1px solid var(--border-color, #555)', borderRadius: '4px', resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={handleDownloadMML} style={{ padding: '8px 16px', backgroundColor: '#bf47ff', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}>
                Download .txt
              </button>
              <button onClick={handleCopy} style={{ padding: '8px 16px', backgroundColor: copyStatus === 'Copied!' ? '#43e97b' : '#4facfe', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}>
                {copyStatus}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Overlay for MIDI Import Mapping */}
      {showMidiModal && midiData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ width: '500px', backgroundColor: 'var(--bg-toolbar, #222)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color, #444)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 15px 0', color: 'var(--text-main, #fff)', fontSize: '18px' }}>Map MIDI Tracks</h2>
            <p style={{ color: 'var(--text-muted, #aaa)', fontSize: '12px', marginBottom: '20px' }}>
              Select which MIDI tracks to import into the engine. The engine supports a maximum of 3 melodic tracks. Drum tracks are highlighted. The BPM will be overwritten to {midiData.originalBpm}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
              {[1, 2, 3].map(dawTrackId => (
                <div key={dawTrackId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', backgroundColor: 'var(--bg-main, #111)', border: '1px solid var(--border-color, #555)', borderRadius: '4px' }}>
                  <label style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-main, #fff)' }}>Track {dawTrackId}</label>
                  <select
                    value={midiTrackMappings[dawTrackId]}
                    onChange={e => setMidiTrackMappings(prev => ({ ...prev, [dawTrackId]: e.target.value }))}
                    style={{ padding: '6px', backgroundColor: '#333', color: '#fff', border: '1px solid #555', borderRadius: '4px', width: '250px' }}
                  >
                    <option value="">-- Ignored --</option>
                    {midiData.availableTracks.map(t => (
                      <option key={t.index} value={t.index}>
                        {t.isPercussion ? '🥁 ' : ''}{t.name} ({t.noteCount} notes)
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => { setShowMidiModal(false); setMidiData(null); }} style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#fff', border: '1px solid #555', cursor: 'pointer', borderRadius: '4px' }}>Cancel</button>
              <button onClick={executeMidiImport} style={{ padding: '8px 16px', backgroundColor: '#00ddff', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}>
                Import Tracks
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
