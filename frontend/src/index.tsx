import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';
import './i18n';
import './index.css';
import './styles/theme.css';

// Configure axios to use backend API endpoint
const configuredApiBaseUrl = (process.env.REACT_APP_API_URL || '').trim().replace(/\/$/, '');
axios.defaults.baseURL = configuredApiBaseUrl;

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
