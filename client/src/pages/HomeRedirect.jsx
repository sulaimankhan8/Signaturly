import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

export default function HomeRedirect() {
  const user = useSelector((state) => state.auth.user);

  if (user) {
    return <Navigate to="/upload" replace />;
  }

  return <Navigate to="/login" replace />;
}
