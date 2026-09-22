import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login'; import Register from './pages/Register'; import SsoCallback from './pages/SsoCallback';
import ForgotPassword from './pages/ForgotPassword'; import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard'; import Pemeliharaan from './pages/Pemeliharaan'; import Pengadaan from './pages/Pengadaan';
import Kendaraan from './pages/Kendaraan'; import RuangRapat from './pages/RuangRapat'; import Settings from './pages/Settings'; import PublicRuangRapat from './pages/PublicRuangRapat';
import ProtectedRoute from './components/ProtectedRoute';
export default function App(){
 return <Routes>
  <Route path="/" element={<Navigate to="/dashboard" replace/>}/><Route path="/login" element={<Login/>}/><Route path="/jadwal-rapat" element={<PublicRuangRapat/>}/><Route path="/register" element={<Register/>}/><Route path="/sso-callback" element={<SsoCallback/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ResetPassword/>}/>
  <Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>}/><Route path="/pemeliharaan" element={<ProtectedRoute><Pemeliharaan/></ProtectedRoute>}/><Route path="/pengadaan" element={<ProtectedRoute><Pengadaan/></ProtectedRoute>}/>
  <Route path="/kendaraan" element={<ProtectedRoute><Kendaraan/></ProtectedRoute>}/><Route path="/ruang-rapat" element={<ProtectedRoute><RuangRapat/></ProtectedRoute>}/><Route path="/settings" element={<ProtectedRoute><Settings/></ProtectedRoute>}/>
  <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
 </Routes>
}
