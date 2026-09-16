import React from 'react';
import { Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell-bg min-h-screen">
      <Sidebar />
      <div className="ml-56 min-h-screen">
        <main className="app-main p-5 md:p-7 min-h-screen">{children}</main>
      </div>
    </div>
  );
}
