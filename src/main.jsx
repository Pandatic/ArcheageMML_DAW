import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { SequenceProvider } from './state/SequenceContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SequenceProvider>
      <App />
    </SequenceProvider>
  </React.StrictMode>,
);
