import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/config/supabase/client';
import type { User, Session, AuthError } from '@supabase/supabase-js';

interface AuthResponse {
  success: boolean;
  error?: string;
  needsEmailConfirmation?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  signup: (email: string, password: string, name?: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // 1. Initial session restoration
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[Auth] Error getting initial session:', error.message);
        }
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (err) {
        console.error('[Auth] Unexpected error restoring session:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // 2. Real-time auth state synchronization
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        let msg = error.message;
        let needsEmailConfirmation = false;

        if (error.message.toLowerCase().includes('email not confirmed') || error.code === 'email_not_confirmed') {
          msg = 'Please confirm your email address before signing in. Check your inbox for the confirmation link.';
          needsEmailConfirmation = true;
        } else if (error.message.toLowerCase().includes('invalid login credentials')) {
          msg = 'Invalid email or password. Please try again.';
        }

        return { success: false, error: msg, needsEmailConfirmation };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed unexpectedly';
      return { success: false, error: message };
    }
  };

  const signup = async (email: string, password: string, name?: string): Promise<AuthResponse> => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name?.trim() || '',
          },
        },
      });

      if (error) {
        let msg = error.message;
        if (error.code === 'weak_password') {
          msg = 'Password is too weak or commonly used. Please choose a stronger password.';
        }
        return { success: false, error: msg };
      }

      // If user is created but session is null, email confirmation is enabled on Supabase
      const needsEmailConfirmation = !data.session;
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
      }

      return {
        success: true,
        needsEmailConfirmation,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed unexpectedly';
      return { success: false, error: message };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[Auth] Error during signOut:', err);
    } finally {
      setUser(null);
      setSession(null);
      localStorage.removeItem('onboardingCompleted');
      localStorage.removeItem('rememberMe');
    }
  };

  const isAuthenticated = !!session;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        session,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
