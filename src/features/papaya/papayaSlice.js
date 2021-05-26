import { createSlice } from '@reduxjs/toolkit'

export const papayaSlice = createSlice({
  name: 'papaya',
  initialState: {
    currentCoord: undefined,
  },
  reducers: {
    setCurrentCoord: (state, action) => {
      state.currentCoord = action.payload
    },
  },
})

export const getCurrentCoord = (state) => state.papaya.currentCoord;

// Action creators are generated for each case reducer function
export const { setCurrentCoord } = papayaSlice.actions

export default papayaSlice.reducer