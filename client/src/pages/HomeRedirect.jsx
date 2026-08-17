import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import Landing from "./Landing";

export default function Home() {
  const user = useSelector((state) => state.auth.user);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Landing />;
}