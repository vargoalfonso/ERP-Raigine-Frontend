import { configureStore } from "@reduxjs/toolkit";
import { apiSlice } from "./instance/index";
import { setupListeners } from "@reduxjs/toolkit/query";

export const apiReducers = {
  [apiSlice.reducerPath]: apiSlice.reducer,
};

export const apiMiddlewares = [apiSlice.middleware];

export const store = configureStore({
  reducer: {
    ...apiReducers,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiMiddlewares),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
setupListeners(store.dispatch);
