import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './home.css';
import { Splash } from '../shared/Splash';
import { initTheme } from '../shared/theme';
import { Home } from './Home';

initTheme();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
    <Home />
  </StrictMode>,
);

import './experiments.css';
