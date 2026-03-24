import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchArtworkEvents, ArtworkEvent } from '../api/artworks';

export const loadArtworkEvents = createAsyncThunk(
  'artworkEvents/loadArtworkEvents',
  async () => {
    return await fetchArtworkEvents();
  }
);

interface ArtworkEventsState {
  events: ArtworkEvent[];
  loading: boolean;
  error: string | null;
}

const initialState: ArtworkEventsState = {
  events: [],
  loading: false,
  error: null,
};

const artworkEventsSlice = createSlice({
  name: 'artworkEvents',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(loadArtworkEvents.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadArtworkEvents.fulfilled, (state, action) => {
        state.loading = false;
        state.events = action.payload;
      })
      .addCase(loadArtworkEvents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Chyba při načítání událostí.';
      });
  },
});

export default artworkEventsSlice.reducer;
