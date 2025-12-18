import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  // Role-based access control - returns 403 Forbidden equivalent
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
              <ShieldX className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">403 - Access Forbidden</h2>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this resource. This area is restricted to authorized users only.
          </p>
          <Button variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
