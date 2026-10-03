import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { appliquer, lireChoix } from './theme.js';

// Thème : « Automatique » (suit le téléphone) tant que rien n'est choisi.
// Posé avant le rendu pour éviter tout clignotement.
appliquer(lireChoix());

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Requis par Chrome pour proposer l'installation PWA (écran d'accueil / bouton "Installer").
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
