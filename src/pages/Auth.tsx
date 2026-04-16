import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, User, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import cartonCloudLogo from '@/assets/cartoncloud-logo.png';

const PENDING_INVITE_KEY = 'dockmgmt_pending_invite';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading: authLoading, signIn, signUp, signInWithGoogle } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; tenantName: string } | null>(null);
  const [processingInvite, setProcessingInvite] = useState(false);
  
  // Form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Get invite token from URL hash fragment or localStorage (for OAuth redirect recovery)
  // Hash fragments are not sent to servers, preventing token leakage in logs/referrers
  const getInviteToken = (): string | null => {
    // Check hash fragment first (e.g., /auth#invite=<uuid>)
    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.slice(1));
      const hashToken = hashParams.get('invite');
      if (hashToken) return hashToken;
    }
    
    // Legacy: also check query params for backwards compatibility
    const urlToken = searchParams.get('invite');
    if (urlToken) {
      // Clear from URL to prevent leakage, then use it
      window.history.replaceState({}, document.title, '/auth');
      return urlToken;
    }
    
    // Check localStorage for token saved before OAuth redirect
    try {
      return localStorage.getItem(PENDING_INVITE_KEY);
    } catch {
      return null;
    }
  };

  // Save invite token to localStorage before OAuth redirect
  const saveInviteToken = (token: string) => {
    try {
      localStorage.setItem(PENDING_INVITE_KEY, token);
    } catch {
      // Ignore storage errors
    }
  };

  // Clear saved invite token
  const clearInviteToken = () => {
    try {
      localStorage.removeItem(PENDING_INVITE_KEY);
    } catch {
      // Ignore storage errors
    }
  };

  // Check for invite token and fetch info
  useEffect(() => {
    const inviteToken = searchParams.get('invite');

    if (!inviteToken) {
      setInviteInfo(null);
      return;
    }

    // Save token for OAuth redirect recovery
    saveInviteToken(inviteToken);

    setActiveTab('signup');
    setInviteInfo(null);

    supabase.functions
      .invoke('invite-info', { body: { inviteToken } })
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching invite info:', error);
          return;
        }

        if (data?.email) {
          setSignupEmail(String(data.email));
          setInviteInfo({
            email: String(data.email),
            tenantName: String(data.tenantName ?? 'Unknown'),
          });
        }
      });
  }, [searchParams]);

  // Process pending invite for logged-in user (handles both direct invite links AND OAuth redirects)
  useEffect(() => {
    if (!user || authLoading || processingInvite) return;

    const inviteToken = getInviteToken();
    if (!inviteToken) {
      // No pending invite, redirect to home
      navigate('/');
      return;
    }

    // Process the invite
    setProcessingInvite(true);
    setError(null);
    setIsLoading(true);

    console.log('[Auth] Processing pending invite for user:', user.email);

    supabase.functions
      .invoke('accept-invite', { body: { inviteToken } })
      .then(({ data, error }) => {
        setIsLoading(false);
        setProcessingInvite(false);
        
        // Clear the saved token regardless of outcome
        clearInviteToken();

        if (error) {
          console.error('Error accepting invite:', error);
          // Check if it's just an email mismatch (user logged in with different account)
          if (error.message?.includes('mismatch')) {
            setError('The invite was sent to a different email address. Please sign in with the correct account or ask for a new invite.');
          } else {
            setError('Unable to accept invitation. Please ask your administrator to resend it.');
          }
          return;
        }

        console.log('[Auth] Invite accepted successfully:', data);
        // Reload to refresh profile/tenant context after backend updates
        window.location.assign('/');
      });
  }, [user, authLoading, processingInvite, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setIsLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password');
      } else {
        setError(error.message);
      }
    }
    // If login succeeds and there's a pending invite, the useEffect will handle it
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const result = signupSchema.safeParse({
      fullName: signupName,
      email: signupEmail,
      password: signupPassword,
      confirmPassword: signupConfirmPassword,
    });
    
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    // Invites are link-based: require a valid invite token
    const inviteToken = getInviteToken();
    if (!inviteToken || !inviteInfo || inviteInfo.email.toLowerCase() !== signupEmail.toLowerCase()) {
      setError('Signup requires a valid invitation link. Please contact your administrator.');
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName);

    if (error) {
      setIsLoading(false);
      if (error.message.includes('already registered')) {
        setError('This email is already registered. Please login instead.');
      } else {
        setError(error.message);
      }
      return;
    }

    // Complete invite acceptance (attach tenant + role) after signup
    const { error: acceptError } = await supabase.functions.invoke('accept-invite', {
      body: { inviteToken },
    });

    setIsLoading(false);
    
    // Clear the saved token
    clearInviteToken();

    if (acceptError) {
      console.error('Error accepting invite after signup:', acceptError);
      setError(
        'Your account was created, but we could not complete the invitation. Please verify your email and reopen the invite link.'
      );
      return;
    }

    window.location.assign('/');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    
    // Ensure invite token is saved before OAuth redirect
    const inviteToken = getInviteToken();
    if (inviteToken) {
      saveInviteToken(inviteToken);
      console.log('[Auth] Saved invite token before Google OAuth:', inviteToken);
    }
    
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
    }
    // After OAuth completes and redirects back, the useEffect will detect the pending invite
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-header">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  // Show loading state while processing invite
  if (processingInvite || (user && getInviteToken())) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-header p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardContent className="pt-8 pb-6 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-4" />
            <p className="text-foreground font-medium">Completing your invitation...</p>
            <p className="text-sm text-muted-foreground mt-2">Please wait while we set up your account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-header p-4">
      {/* Login Card */}
      <Card className="w-full max-w-md border-0 shadow-2xl">
        <CardContent className="pt-8 pb-6">
          {/* Logo and Branding inside card */}
          <div className="mb-6 text-center">
            <img 
              src={cartonCloudLogo} 
              alt="CartonCloud" 
              className="h-10 mx-auto mb-3"
            />
            <h1 className="text-2xl font-bold text-foreground mb-1">Dock Management</h1>
            <p className="text-muted-foreground text-sm">By CartonCloud</p>
          </div>
          
          {inviteInfo && (
            <div className="mb-4 p-3 bg-accent/10 rounded-lg text-center">
              <p className="text-sm text-foreground">
                You've been invited to join <strong>{inviteInfo.tenantName}</strong>
              </p>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="pl-10"
                      disabled={!!inviteInfo}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-confirm"
                      type="password"
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                {!inviteInfo && (
                  <p className="text-xs text-muted-foreground">
                    Note: Signup requires an invitation from your administrator.
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              or continue with
            </span>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
