import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import './index.css';
import App from './App';
import { readShareLink } from './state/shareLink';

const root = ReactDOM.createRoot(document.getElementById('root'));
// Share links are compressed, and unpacking them takes a moment before the first render.
readShareLink(window.location.hash).then((shared) => root.render(
  <React.StrictMode>
    <App shared={shared} />
  </React.StrictMode>
));
