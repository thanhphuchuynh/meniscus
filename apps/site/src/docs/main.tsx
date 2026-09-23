import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import '../home/home.css';
import './docs.css';
import { initTheme } from '../shared/theme';
import { Docs } from './Docs';

initTheme();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Docs />
  </StrictMode>,
);
