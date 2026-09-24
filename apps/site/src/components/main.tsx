import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './components.css';
import { Splash } from '../shared/Splash';
import { initTheme } from '../shared/theme';
import { Components } from './Components';

initTheme();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
    <Components />
  </StrictMode>,
);
