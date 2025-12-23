import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Only log in development mode
const isDev = import.meta.env.DEV;

const PENDING_INVITE_KEY = 'dockmgmt_pending_invite';

interface UserProfile {
  id: string;
  tenant_id: string | null;
  email: string | null;
  full_name: string | null;
}

interface UserRole {
  role: 'admin' | 'operator' | 'viewer' | 'super_user';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  roles: UserRole[];
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: 'admin' | 'operator' | 'viewer' | 'super_user') => boolean;
  isAdmin: boolean;
  isSuperUser: boolean;
  hasTenant: boolean;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = useCallback(async (userId: string) => {
    // Fetch profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, tenant_id, email, full_name')
      .eq('id', userId)
      .single();
    
    if (profileData) {
      setProfile(profileData);
    }

    // Fetch roles
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (rolesData) {
      setRoles(rolesData as UserRole[]);
    }
  }, []);

  // Check and process pending invite after login
  const processPendingInvite = useCallback(async (currentUser: User) => {
    try {
      const pendingToken = localStorage.getItem(PENDING_INVITE_KEY);
      
      // Try token-based acceptance first
      if (pendingToken) {
        console.log('[Auth] Processing pending invite token for user:', currentUser.email);
        
        const { data, error } = await supabase.functions.invoke('accept-invite', {
          body: { inviteToken: pendingToken },
        });

        // Always clear the token after attempting
        localStorage.removeItem(PENDING_INVITE_KEY);

        if (!error && data?.success) {
          console.log('[Auth] Invite accepted via token:', data);
          // Refetch user data to get updated tenant/role
          await fetchUserData(currentUser.id);
          // Force a page reload to refresh all tenant context
          window.location.reload();
          return;
        }
        
        if (isDev) console.error('[Auth] Token-based invite failed, trying email match:', error?.message);
      }

      // Fallback: Try to auto-match by email if user has no tenant
      if (!currentUser.email) return;
      
      console.log('[Auth] Checking for pending invite by email:', currentUser.email);
      
      const { data: matchData, error: matchError } = await supabase.functions.invoke('accept-invite-by-email', {
        body: { email: currentUser.email },
      });

      if (matchError) {
        if (isDev) console.error('[Auth] Email-based invite match failed:', matchError.message);
        return;
      }

      if (matchData?.success) {
        console.log('[Auth] Invite accepted via email match:', matchData);
        await fetchUserData(currentUser.id);
        window.location.reload();
      }
    } catch (err) {
      if (isDev) console.error('[Auth] Error processing pending invite:', err);
      localStorage.removeItem(PENDING_INVITE_KEY);
    }
  }, [fetchUserData]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
            
            // Check for pending invite on SIGNED_IN event (OAuth redirect case)
            if (event === 'SIGNED_IN') {
              setTimeout(() => {
                processPendingInvite(session.user);
              }, 100); // Small delay to ensure profile is created first
            }
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
        
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData, processPendingInvite]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Clear any pending invite and cached tenant on logout
    localStorage.removeItem(PENDING_INVITE_KEY);
    localStorage.removeItem('crossdock_active_tenant');
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  };

  const hasRole = (role: 'admin' | 'operator' | 'viewer' | 'super_user') => {
    return roles.some(r => r.role === role);
  };

  const refreshUserData = useCallback(async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  }, [user, fetchUserData]);

  const value = {
    user,
    session,
    profile,
    roles,
    isLoading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    hasRole,
    isAdmin: hasRole('admin'),
    isSuperUser: hasRole('super_user'),
    hasTenant: !!profile?.tenant_id,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
