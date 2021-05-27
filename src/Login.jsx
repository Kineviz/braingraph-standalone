import React, { useState } from "react";
import { useDispatch } from "react-redux";

import "./Login.css";
import * as cognito from "./cognito";
import { setJwt } from "./features/s3-url-service/s3UrlServiceSlice";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const dispatch = useDispatch();

  function validateForm() {
    return username.length > 0 && password.length > 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const jwt = await cognito.login(username, password);
    dispatch(setJwt(jwt));
  }

  return (
    <div className="Login" className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="flex space-x-2">
          <label className="text-right">Username</label>
          <input
            className="w-full px-4 py-2 border rounded-lg"
            autoFocus
            type="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </fieldset>
        <fieldset className="flex space-x-2">
          <label className="text-right">Password</label>
          <input className="w-full px-4 py-2 border rounded-lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </fieldset>
        <button className="rounded border-2 px-4 py-2" type="submit" disabled={!validateForm()}>
          Login
        </button>
      </form>
    </div>
  );
}
