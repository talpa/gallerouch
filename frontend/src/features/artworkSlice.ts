import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  artworks: [],
};

const artworkSlice = createSlice({
  name: 'artwork',
  initialState,
  reducers: {
    setArtworks(state, action) {
      state.artworks = action.payload;
    },
  },
});

export const { setArtworks } = artworkSlice.actions;
export default artworkSlice.reducer;
