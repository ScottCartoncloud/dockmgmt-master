import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

// Enable dev bypass for testing in Lovable preview
const DEV_BYPASS_AUTH = true; // Set to false for production

interface ProtectedRouteProps {
  children: ReactNode;
  requireTenant?: boolean;
  requiredRole?: 'admin' | 'operator' | 'viewer' | 'super_user';
}

export function ProtectedRoute({ 
  children, 
  requireTenant = false,
  requiredRole 
}: ProtectedRouteProps) {
  const { user, isLoading, hasTenant, hasRole } = useAuth();

  // Dev bypass - skip all auth checks in development
  if (DEV_BYPASS_AUTH) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requireTenant && !hasTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-xl font-semibold text-foreground mb-2">No Tenant Access</h2>
          <p className="text-muted-foreground">
            Your account hasn't been assigned to a tenant yet. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have the required permissions to access this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
