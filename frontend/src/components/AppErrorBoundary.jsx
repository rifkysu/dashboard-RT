import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('[BIRO UMUM FRONTEND ERROR]', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{minHeight:'100vh',padding:'40px',background:'#f8fafc',fontFamily:'Inter,Arial,sans-serif',color:'#0f172a'}}>
        <div style={{maxWidth:760,margin:'40px auto',background:'#fff',border:'1px solid #e2e8f0',borderRadius:18,padding:28,boxShadow:'0 15px 40px rgba(15,23,42,.08)'}}>
          <h1 style={{margin:'0 0 10px',fontSize:24}}>Aplikasi mengalami error</h1>
          <p style={{color:'#64748b'}}>Halaman tidak lagi blank. Detail error ditampilkan di bawah agar mudah diperbaiki.</p>
          <pre style={{marginTop:18,padding:16,background:'#f1f5f9',borderRadius:12,whiteSpace:'pre-wrap',fontSize:13,overflow:'auto'}}>{String(this.state.error?.stack || this.state.error)}</pre>
          <button onClick={() => window.location.reload()} style={{marginTop:18,padding:'10px 16px',border:0,borderRadius:10,background:'#0f172a',color:'#fff',fontWeight:700,cursor:'pointer'}}>Muat Ulang</button>
        </div>
      </div>
    );
  }
}
