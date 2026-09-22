import React from 'react';
import { Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

function MaintenanceNotice({ message }) {
  return (
    <div className="max-w-xl mx-auto mt-16 bg-white border border-amber-200 rounded-2xl shadow-sm p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-[32px]">build</span>
      </div>
      <h2 className="text-xl font-bold text-slate-900">Sedang Dalam Mode Maintenance</h2>
      <p className="text-sm text-slate-500 mt-2">{message || 'Menu ini sedang dalam mode maintenance. Silakan coba lagi nanti.'}</p>
    </div>
  );
}

export default function ProtectedRoute({ children, menuKey }) {
  const { user, loading, isMenuDown, maintenance } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  const down = menuKey && isMenuDown(menuKey);
  return (
    <div className="app-shell-bg min-h-screen">
      <Sidebar />
      <div className="ml-56 min-h-screen">
        <main className="app-main p-5 md:p-7 min-h-screen">
          {down ? <MaintenanceNotice message={maintenance[menuKey]?.message} /> : children}
        </main>
      </div>
    </div>
  );
}
