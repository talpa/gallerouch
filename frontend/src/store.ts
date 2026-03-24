
import { configureStore } from '@reduxjs/toolkit';
import artworkReducer from './features/artworkSlice';
import artworkEventsReducer from './features/artworkEventsSlice';
import authReducer from './features/authSlice';

export const store = configureStore({
  reducer: {
    artwork: artworkReducer,
    artworkEvents: artworkEventsReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
