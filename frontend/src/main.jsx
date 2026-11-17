import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

// Render hosts sometimes serve a 404 response for nested SPA paths before
// their rewrite rules are synchronized. Hash routing keeps all app routes
// on the root document and avoids server-side deep-link resolution entirely.
// Preserve existing bookmarked BrowserRouter URLs by converting them once.
if (window.location.pathname !== '/' && !window.location.hash) {
  const legacyPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const target = legacyPath + window.location.search + window.location.hash;
  window.history.replaceState(null, '', '/#' + target);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
