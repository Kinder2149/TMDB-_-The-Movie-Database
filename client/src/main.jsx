import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Thème : choix mémorisé, sinon on suit la préférence du système.
// Posé avant le rendu pour éviter tout clignotement.
const storedTheme = localStorage.getItem('theme');
const initialTheme =
  storedTheme ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = initialTheme;

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
