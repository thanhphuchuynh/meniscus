import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/base.css';
import './components.css';
import { initTheme } from '../shared/theme';
import { Components } from './Components';

initTheme();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Components />
  </StrictMode>,
);
