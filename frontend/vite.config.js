import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rolldownOptions: {
      output: {
        // Library (React, router, axios) dipisah dari kode aplikasi: jarang berubah, jadi tetap
        // tersimpan di cache browser walau aplikasi di-update -> unduhan setelah deploy lebih kecil.
        codeSplitting: {
          groups: [{ name: 'vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|axios)[\\/]/ }],
        },
      },
    },
  },
});
