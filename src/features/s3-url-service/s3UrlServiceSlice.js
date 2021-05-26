import { createSlice } from '@reduxjs/toolkit'

export const s3UrlServiceSlice = createSlice({
  name: 's3UrlService',
  initialState: {
    jwt: undefined,
  },
  reducers: {
    setJwt: (state, action) => {
      // Redux Toolkit allows us to write "mutating" logic in reducers. It
      // doesn't actually mutate the state because it uses the Immer library,
      // which detects changes to a "draft state" and produces a brand new
      // immutable state based off those changes
      state.jwt = action.payload
    },
  },
})

export const getJwt = state => state.s3UrlService.jwt;

// Action creators are generated for each case reducer function
export const { setJwt } = s3UrlServiceSlice.actions

export default s3UrlServiceSlice.reducer