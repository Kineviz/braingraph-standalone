import React from "react";
import { useSelector } from "react-redux";

import Login from "./Login.jsx";
import Papaya from "./Papaya.jsx";

import "./App.css";

export default function App() {
  const jwt = useSelector((state) => state.s3UrlService.jwt);

  return <div id="app-body">{(jwt && <Papaya />) || <Login />}</div>;
}
