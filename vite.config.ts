import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages hosts this project at /Coinbound/. Keep local previews portable.
const base = process.env.GITHUB_ACTIONS === 'true' ? '/Coinbound/' : './';

export default defineConfig({ plugins: [react()], base });
