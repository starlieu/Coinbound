import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project sites under /<repository-name>/.
// Keep local development and custom-domain deployments at the root.
const base = process.env.GITHUB_ACTIONS === 'true' ? '/Coinbound/' : './';

export default defineConfig({ plugins: [react()], base });
