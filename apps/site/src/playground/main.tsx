import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import '../home/home.css';
import './playground.css';
import { initTheme } from '../shared/theme';
import { Playground } from './Playground';

initTheme();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
