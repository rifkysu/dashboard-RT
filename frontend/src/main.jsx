import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './app-theme.css';
import { AuthProvider } from './context/AuthContext.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppErrorBoundary><App /></AppErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
