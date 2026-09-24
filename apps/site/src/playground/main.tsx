import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import '../home/home.css';
import './playground.css';
import { Splash } from '../shared/Splash';
import { initTheme } from '../shared/theme';
import { Playground } from './Playground';

initTheme();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
    <Playground />
  </StrictMode>,
);
