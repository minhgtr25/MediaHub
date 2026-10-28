import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase, initialAuthCallback } from "../lib/supabase";
import { authErrorMessage } from "../lib/auth";
import { authService } from "../services";
import { ApiError } from "../services/api";
import { workspaceHome, type Role } from "../lib/permissions";
import type { Profile } from "../types/auth";
const Context = createContext<{
  currentUser: User | null;
  profile: Profile | null;
  role: Role | null;
  loading: boolean;
  error: string;
  passwordSetup: boolean;
  completePasswordSetup: () => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}>({
  currentUser: null,
  profile: null,
  role: null,
  loading: true,
  error: "",
  passwordSetup: false,
  completePasswordSetup: () => {},
  refresh: async () => {},
  logout: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [passwordSetup, setPasswordSetup] = useState(
    initialAuthCallback.passwordSetup,
  );
  const generation = useRef(0);
  const verifiedSessionId = useRef<string | null>(null);
  const [currentUser, setUser] = useState<User | null>(null),
    [profile, setProfile] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function refresh() {
    const current = ++generation.current;
    if (!profile) setLoading(true);
    try {
      setError("");
      const nextProfile = await authService.me();
      if (current === generation.current) {
        setProfile(nextProfile);
        verifiedSessionId.current = currentUser?.id ?? null;
      }
    } catch (e) {
      if (current === generation.current) {
        setProfile(null);
        setError((e as Error).message);
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  async function logout() {
    const result = await authService.logout();
    if (result.error) throw result.error;
    generation.current++;
    verifiedSessionId.current = null;
    setUser(null);
    setProfile(null);
    setError("");
    setLoading(false);
    setPasswordSetup(false);
  }
  useEffect(() => {
    if (!supabase) {
      setError("Chưa cấu hình dịch vụ đăng nhập. Vui lòng liên hệ MediaHub.");
      setLoading(false);
      return;
    }
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setPasswordSetup(true);
      if (event === "SIGNED_OUT") setPasswordSetup(false);
      const current = ++generation.current;
      const background =
        !!session && verifiedSessionId.current === session.user.id;
      setUser(session?.user ?? null);
      if (!background) {
        setProfile(null);
        verifiedSessionId.current = null;
      }
      setError("");
      if (!session) {
        setLoading(false);
        return;
      }
      if (!background) setLoading(true);
      setTimeout(() => {
        if (!active || current !== generation.current) return;
        authService
          .me()
          .then((p) => {
            if (active && current === generation.current) {
              setProfile(p);
              verifiedSessionId.current = session.user.id;
            }
          })
          .catch((e) => {
            if (
              background &&
              e instanceof ApiError &&
              (e.status === 0 || e.status >= 500)
            )
              return;
            if (active && current === generation.current) {
              setProfile(null);
              verifiedSessionId.current = null;
              setError(authErrorMessage(e));
            }
          })
          .finally(() => {
            if (active && current === generation.current) setLoading(false);
          });
      }, 0);
    });
    return () => {
      active = false;
      generation.current++;
      data.subscription.unsubscribe();
    };
  }, []);
  return (
    <Context.Provider
      value={{
        currentUser,
        profile,
        role: profile?.role ?? null,
        loading,
        error,
        passwordSetup,
        completePasswordSetup: () => setPasswordSetup(false),
        refresh,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
export function AuthCallbackRedirect() {
  const auth = useAuth(),
    location = useLocation();
  return auth.passwordSetup &&
    auth.currentUser &&
    location.pathname !== "/reset-password" ? (
    <Navigate to="/reset-password" replace />
  ) : null;
}
function Protected({ role }: { role?: string | string[] }) {
  const auth = useAuth();
  const location = useLocation();
  const [logoutError, setLogoutError] = useState("");
  if (auth.loading)
    return (
      <div className="panel skeleton" role="status">
        Đang xác thực…
      </div>
    );
  if (!auth.currentUser)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  if (auth.error || !auth.profile)
    return (
      <div className="panel" role="alert">
        {auth.error || "Không thể xác thực hồ sơ tài khoản. Vui lòng thử lại."}
        <button className="btn btn-ghost" onClick={auth.refresh}>
          Thử lại
        </button>
        <button
          className="btn btn-ghost"
          onClick={() =>
            auth.logout().catch((e) => setLogoutError((e as Error).message))
          }
        >
          Đăng xuất
        </button>
        {logoutError && <p className="error">{logoutError}</p>}
      </div>
    );
  if (
    role &&
    !(Array.isArray(role) ? role.includes(auth.role ?? "") : auth.role === role)
  )
    return <Navigate to={workspaceHome(auth.role)} replace />;
  return <Outlet />;
}
export const CustomerRoute = () => (
  <Protected role={["CUSTOMER", "BUSINESS"]} />
);
export const AdminRoute = () => <Protected role="ADMIN" />;

export const StaffRoute = () => <Protected role="STAFF" />;
export const AuthenticatedRoute = () => <Protected />;

export const CreatorRoute = () => (
  <Protected role={["CREATOR", "STUDENT_CREATOR"]} />
);
