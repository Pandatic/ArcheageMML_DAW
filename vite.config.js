import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // This tells Vite to allow ANY host (perfect for temporary tunnels)
    // If you're on an older version of Vite that doesn't support 'true', 
    // use: allowedHosts: ['hot-dryers-learn.loca.lt', 'localhost']
  }
})