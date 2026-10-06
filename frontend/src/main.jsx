import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
// Urutan penting: font & ikon -> Tailwind -> tema aplikasi (menimpa utilitas Tailwind).
import './fonts.css';
import './tailwind.css';
import './app-theme.css';
import './dark-theme.css';
import { AuthProvider } from './context/AuthContext.jsx';
import { FeedbackProvider } from './components/Feedback.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Error saat render tampil sebagai pesan + tombol Muat Ulang, bukan layar putih kosong. */}
    <AppErrorBoundary>
      <BrowserRouter>
        <FeedbackProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </FeedbackProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
