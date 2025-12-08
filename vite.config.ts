import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // Try multiple possible environment variable names
    const apiKey = env.GEMINI_API_KEY || env.API_KEY || env.VITE_API_KEY || env.VITE_GEMINI_API_KEY;
    
    console.log("Vite Config: Loading environment variables", {
      hasGEMINI_API_KEY: !!env.GEMINI_API_KEY,
      hasAPI_KEY: !!env.API_KEY,
      hasVITE_API_KEY: !!env.VITE_API_KEY,
      hasVITE_GEMINI_API_KEY: !!env.VITE_GEMINI_API_KEY,
      finalApiKeyExists: !!apiKey
    });
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
        'import.meta.env.VITE_API_KEY': JSON.stringify(apiKey),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
