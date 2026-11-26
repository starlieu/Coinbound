import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Coinbound: élément #root introuvable.');

try {
  createRoot(root).render(<React.StrictMode><App /></React.StrictMode>);
} catch (error) {
  console.error('Coinbound n’a pas pu démarrer :', error);
  root.innerHTML = '<main class="fatal"><div class="fatal-card"><div class="boot-mark">C</div><h1>Coinbound</h1><p>Le jeu n’a pas pu démarrer. Recharge la page ou réessaie plus tard.</p></div></main>';
}
