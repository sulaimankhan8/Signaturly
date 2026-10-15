import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { fetchUserProfileApi } from "../api/user.api";

/**
 * The signed-in person ({ name, email }), for screens opened straight from a link or a reload.
 *
 * After a reload the session comes back on the first request (the API client refreshes it), so
 * the store may not hold the person yet; their profile is then asked for once.
 */
export function useCurrentUser() {
  const stored = useSelector((state) => state.auth.user);
  const [fetched, setFetched] = useState(null);

  useEffect(() => {
    if (stored?.email) return undefined;
    let current = true;
    fetchUserProfileApi()
      .then((profile) => current && setFetched(profile))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [stored?.email]);

  return stored?.email ? stored : fetched;
}
