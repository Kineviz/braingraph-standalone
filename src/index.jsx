import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import $ from "jquery";

import { store, persistor } from "./store";
import App from "./App.jsx";

import "tailwindcss/tailwind.css"
import "./index.css";

const appRootId = "app-root";

// Render the app
ReactDOM.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  </React.StrictMode>,
  document.getElementById(appRootId)
);

function hijackGrove() {
  // Remove and save the app root <div>
  const appElement = $(`#${appRootId}`).detach();

  // Remove everything in the <body>
  $("body").children().detach();

  // Put the app root <div> into the <body>
  $(appElement).prependTo("body");
}
// hijackGrove();

if (import.meta.hot) {
  import.meta.hot.accept();
}