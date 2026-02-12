import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { AuditService } from "@/services/audit.service";
import { RateLimitService } from "@/services/rateLimit.service";

type AppRole = "admin" | "operator" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole;
  profile: { full_name: string; email: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [profile, setProfile] = useState<{ full_name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [roleRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("full_name, email").eq("user_id", userId).maybeSingle(),
    ]);
    setRole((roleRes.data?.role as AppRole) ?? null);
    setProfile(profileRes.data ?? null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      // Check rate limit before attempting login
      const clientIP = await RateLimitService.getClientIP();
      const rateLimitResult = await RateLimitService.checkIpRateLimit(clientIP, 'LOGIN');
      
      if (!rateLimitResult.allowed) {
        return { 
          error: new Error(rateLimitResult.error || 'Too many login attempts') as Error 
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      
      // Log successful login
      if (!error && data.user) {
        await AuditService.logUserLogin(data.user.id, email);
      }
      
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      // Check rate limit before attempting signup
      const clientIP = await RateLimitService.getClientIP();
      const rateLimitResult = await RateLimitService.checkIpRateLimit(clientIP, 'SIGNUP');
      
      if (!rateLimitResult.allowed) {
        return { 
          error: new Error(rateLimitResult.error || 'Too many signup attempts') as Error 
        };
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    if (user) {
      await AuditService.logUserLogout(user.id);
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
