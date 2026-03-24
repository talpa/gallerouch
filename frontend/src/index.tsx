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
axios.defaults.baseURL = 'http://localhost:4777';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);
