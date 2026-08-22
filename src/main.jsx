import React from 'react';
import ReactDOM from 'react-dom/client';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import App from './App.jsx';
import './index.css';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin); // ✅ sekali di sini, berlaku global

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);