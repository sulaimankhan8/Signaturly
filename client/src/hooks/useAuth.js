import { useSelector } from "react-redux";

export const useAuth = () => {
  console.log("useAuth called",useSelector((state) => state.auth));
  return useSelector((state) => state.auth);
};
