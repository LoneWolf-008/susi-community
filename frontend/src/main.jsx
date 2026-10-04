import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import App from './App.jsx';
import AuthProvider from './context/AuthProvider';
import ToastProvider from './components/ui/ToastProvider';
import TransitionProvider from './components/routing/TransitionProvider';
import './index.css';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin); // ✅ sekali di sini, berlaku global

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <TransitionProvider>
            <App />
          </TransitionProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
