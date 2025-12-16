import { User } from '@/types/booking';
import { Bell, ChevronDown, LogOut, Search, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  user: User;
}

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  dock_operator: 'Dock Operator',
  viewer: 'Viewer',
};

export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-header text-header-foreground">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-header-foreground/10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded flex items-center justify-center">
              <Truck className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="font-semibold text-lg">CrossDock</span>
          </div>
          
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-header-foreground/60" />
            <Input
              placeholder="Search for anything!"
              className="pl-10 bg-header-foreground/10 border-header-foreground/20 text-header-foreground placeholder:text-header-foreground/50 focus:bg-header-foreground/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm">{user.name}</span>
          <Button variant="ghost" size="sm" className="text-header-foreground hover:bg-header-foreground/10">
            Log Out
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-header-foreground hover:bg-header-foreground/10">
                {roleLabels[user.role]}
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Administrator</DropdownMenuItem>
              <DropdownMenuItem>Dock Operator</DropdownMenuItem>
              <DropdownMenuItem>Viewer</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="text-header-foreground hover:bg-header-foreground/10 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center">
              3
            </span>
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-1 px-4 py-2">
        <Button variant="ghost" className="text-header-foreground hover:bg-header-foreground/10">
          Dashboard
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-header-foreground hover:bg-header-foreground/10">
              + Quick Add <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>New Booking</DropdownMenuItem>
            <DropdownMenuItem>New PO Reference</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-header-foreground hover:bg-header-foreground/10">
              Transport <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Inbound</DropdownMenuItem>
            <DropdownMenuItem>Outbound</DropdownMenuItem>
            <DropdownMenuItem>Cross Dock</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-header-foreground hover:bg-header-foreground/10">
              Warehouse <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Dock Schedule</DropdownMenuItem>
            <DropdownMenuItem>Inventory</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="text-header-foreground hover:bg-header-foreground/10">
              Reports <ChevronDown className="w-4 h-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Daily Summary</DropdownMenuItem>
            <DropdownMenuItem>Performance</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" className="text-header-foreground hover:bg-header-foreground/10">
          Contacts
        </Button>
      </nav>
    </header>
  );
}
