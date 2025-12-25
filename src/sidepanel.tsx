import React from 'react';
import ReactDOM from 'react-dom/client';
import ServerPanel from './components/ServerPanel';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import './playground.css';
import './backgrounds.css';

ReactDOM.createRoot(document.getElementById('sidepanel-root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ServerPanel />
    </ErrorBoundary>
  </React.StrictMode>,
);
