import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login'; import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword'; import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard'; import Pemeliharaan from './pages/Pemeliharaan'; import Pengadaan from './pages/Pengadaan';
import Kendaraan from './pages/Kendaraan'; import RuangRapat from './pages/RuangRapat'; import Settings from './pages/Settings'; import Profile from './pages/Profile'; import Akun from './pages/Akun'; import PublicRuangRapat from './pages/PublicRuangRapat';
import Landing from './pages/Landing';
import ProtectedRoute, { MenuGate } from './components/ProtectedRoute';
import { PublicLayout } from './components/PageTransition';
export default function App(){
 return <Routes>
  <Route element={<PublicLayout/>}>
   <Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/><Route path="/jadwal-rapat" element={<PublicRuangRapat/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ResetPassword/>}/>
  </Route>
  {/* Layout login dipasang sekali: sidebar tetap, cuma isi halaman yang berganti (lihat ProtectedRoute.jsx). */}
  <Route element={<ProtectedRoute/>}>
   <Route path="/dashboard" element={<MenuGate menuKey="dashboard"><Dashboard/></MenuGate>}/><Route path="/pemeliharaan" element={<MenuGate menuKey="pemeliharaan"><Pemeliharaan/></MenuGate>}/><Route path="/pengadaan" element={<MenuGate menuKey="pengadaan"><Pengadaan/></MenuGate>}/>
   <Route path="/kendaraan" element={<MenuGate menuKey="kendaraan"><Kendaraan/></MenuGate>}/><Route path="/ruang-rapat" element={<MenuGate menuKey="ruang-rapat"><RuangRapat/></MenuGate>}/><Route path="/settings" element={<Settings/>}/><Route path="/profile" element={<Profile/>}/><Route path="/akun" element={<Akun/>}/>
  </Route>
  <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes>
}
