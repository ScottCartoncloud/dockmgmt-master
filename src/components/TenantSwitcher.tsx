import { useState } from 'react';
import { ChevronDown, Search, Truck, Shield, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';

export function TenantSwitcher() {
  const navigate = useNavigate();
  const { tenants, activeTenant, setActiveTenant, isLoading } = useTenantContext();
  const { isSuperUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTenantSelect = (tenant: typeof tenants[0]) => {
    setActiveTenant(tenant);
    setSearchQuery('');
    setOpen(false);
  };

  const handleAdminClick = () => {
    setOpen(false);
    navigate('/admin');
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 hover:bg-header-foreground/10 px-2"
        >
          <div className="w-8 h-8 bg-accent rounded flex items-center justify-center">
            <Truck className="w-5 h-5 text-accent-foreground" />
          </div>
          <div className="flex flex-col items-start">
            <span className="font-semibold text-lg text-header-foreground leading-tight">
              {activeTenant?.name || 'Dock Management'}
            </span>
            {activeTenant && (
              <span className="text-[10px] text-header-foreground/60 leading-tight">
                Dock Management
              </span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-header-foreground/60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="start" 
        className="w-72 bg-header border-header-foreground/20"
        sideOffset={8}
      >
        {/* Header - Administration link */}
        <div 
          className="px-3 py-2 border-b border-header-foreground/20 cursor-pointer hover:bg-header-foreground/10 transition-colors"
          onClick={handleAdminClick}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-header-foreground">
              Administration
            </span>
            {isSuperUser && (
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-header-foreground/10 text-header-foreground rounded-full">
                <Shield className="w-3 h-3" />
                Super User
              </span>
            )}
          </div>
        </div>

        {/* Search input */}
        <div className="p-2 border-b border-header-foreground/20">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-header-foreground/50" />
            <Input
              placeholder="Search for a tenant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-header-foreground/10 border-header-foreground/20 text-header-foreground placeholder:text-header-foreground/50 text-sm"
            />
          </div>
        </div>

        {/* Tenant list */}
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {isLoading ? (
              <div className="px-3 py-4 text-center text-sm text-header-foreground/60">
                Loading tenants...
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-header-foreground/60">
                {searchQuery ? 'No tenants found' : 'No tenants available'}
              </div>
            ) : (
              filteredTenants.map((tenant) => (
                <DropdownMenuItem
                  key={tenant.id}
                  onClick={() => handleTenantSelect(tenant)}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer text-header-foreground hover:bg-header-foreground/10 focus:bg-header-foreground/10 focus:text-header-foreground"
                >
                  <span className="text-sm">{tenant.name}</span>
                  {activeTenant?.id === tenant.id && (
                    <Check className="w-4 h-4 text-accent" />
                  )}
                </DropdownMenuItem>
              ))
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
