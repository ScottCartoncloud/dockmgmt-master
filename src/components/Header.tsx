import { 
  ChevronDown, 
  Search, 
  Settings,
  DoorOpen,
  LayoutGrid,
  Link2,
  Users,
  Clock,
  LogOut,
  Truck,
  Building2,
  Warehouse
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { TenantSwitcher } from '@/components/TenantSwitcher';

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  operator: 'Dock Operator',
  viewer: 'Viewer',
  super_user: 'Super User',
};

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, roles, signOut, isAdmin, isSuperUser } = useAuth();
  const isAdminRoute = location.pathname === '/admin';

  const primaryRole = roles[0]?.role || 'viewer';
  const displayName = profile?.full_name || user?.email || 'User';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="bg-header text-header-foreground">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-header-foreground/10">
        <div className="flex items-center gap-6">
          <TenantSwitcher />
          
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-header-foreground/60" />
            <Input
              placeholder="Search for anything!"
              className="pl-10 bg-header-foreground/10 border-header-foreground/20 text-header-foreground placeholder:text-header-foreground/50 focus:bg-header-foreground/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm">{displayName}</span>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-header-foreground hover:bg-header-foreground/10 gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </Button>
          <span className="text-xs px-2 py-1 bg-header-foreground/10 rounded">
            {roleLabels[primaryRole]}
          </span>
        </div>
      </div>

      {/* Navigation - Centered */}
      {!isAdminRoute && (
        <nav className="flex items-center justify-center gap-2 px-4 py-2">
          <Button 
            variant="ghost" 
            className="text-header-foreground hover:bg-header-foreground/10 gap-2"
            onClick={() => navigate('/')}
          >
            <Truck className="w-4 h-4" />
            Bookings
          </Button>
          
          <span className="text-header-foreground/30">|</span>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="text-header-foreground hover:bg-header-foreground/10 gap-2">
                <Settings className="w-4 h-4" />
                Settings
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Configuration</DropdownMenuLabel>
              <DropdownMenuItem className="gap-2" onClick={() => navigate('/settings?tab=docks')}>
                <DoorOpen className="w-4 h-4" />
                Dock Configuration
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => navigate('/settings?tab=cards')}>
                <LayoutGrid className="w-4 h-4" />
                Card Configuration
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => navigate('/settings?tab=carriers')}>
                <Truck className="w-4 h-4" />
                Carrier Management
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => navigate('/settings?tab=warehouses')}>
                <Warehouse className="w-4 h-4" />
                Warehouse Management
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => navigate('/settings?tab=integration')}>
                <Link2 className="w-4 h-4" />
                CartonCloud Integration
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Administration</DropdownMenuLabel>
              {(isAdmin || isSuperUser) && (
                <DropdownMenuItem className="gap-2" onClick={() => navigate('/settings?tab=organisation')}>
                  <Building2 className="w-4 h-4" />
                  Organisation Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="gap-2" onClick={() => navigate('/settings?tab=users')}>
                <Users className="w-4 h-4" />
                User Management
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => navigate('/settings?tab=defaults')}>
                <Clock className="w-4 h-4" />
                Booking Defaults
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      )}
    </header>
  );
}
