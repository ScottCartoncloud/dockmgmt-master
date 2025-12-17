import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContext } from '@/hooks/useTenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Search, Plus, Pencil, Mail, Loader2, UserPlus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type AppRole = 'admin' | 'operator' | 'viewer';

interface UserWithRole {
  id: string;
  email: string | null;
  full_name: string | null;
  tenant_id: string | null;
  role: AppRole | null;
  is_active: boolean;
}

const roleLabels: Record<AppRole, string> = {
  admin: 'Admin',
  operator: 'Operator',
  viewer: 'Viewer',
};

const roleBadgeVariants: Record<AppRole, 'default' | 'secondary' | 'outline'> = {
  admin: 'default',
  operator: 'secondary',
  viewer: 'outline',
};

export function UserManagement() {
  const queryClient = useQueryClient();
  const { isAdmin, isSuperUser } = useAuth();
  const { activeTenant, isLoading: isTenantLoading } = useTenantContext();
  const canManageUsers = isAdmin || isSuperUser;

  const [searchQuery, setSearchQuery] = useState('');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);

  // Form state for add user
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('viewer');

  // Form state for edit user
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('viewer');
  const [editActive, setEditActive] = useState(true);

  // Fetch users for the current tenant
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['tenant-users', activeTenant?.id],
    queryFn: async () => {
      if (!activeTenant?.id) return [];

      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, tenant_id')
        .eq('tenant_id', activeTenant.id);

      if (error) throw error;

      // Fetch roles for these users
      const userIds = profiles?.map(p => p.id) || [];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.id);
        return {
          ...profile,
          role: (userRole?.role as AppRole) || null,
          is_active: true, // Default to active since we don't have this field yet
        };
      });

      return usersWithRoles;
    },
    enabled: !!activeTenant?.id,
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async ({ name, email, role }: { name: string; email: string; role: AppRole }) => {
      if (!activeTenant?.id) throw new Error('No tenant selected');

      // Create invite record and get the ID
      const { data: invite, error } = await supabase
        .from('tenant_invites')
        .insert({
          email,
          tenant_id: activeTenant.id,
          role,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Send invite email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-invite-email', {
        body: {
          email,
          inviteToken: invite.id,
          tenantName: activeTenant.name,
          role: roleLabels[role],
          appUrl: window.location.origin,
        },
      });

      if (emailError) {
        console.error('Failed to send invite email:', emailError);
        // Don't throw - invite was created, email sending is secondary
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-invites'] });
      toast({
        title: 'Invitation Sent',
        description: `An invitation has been sent to ${newUserEmail}.`,
      });
      setAddDialogOpen(false);
      resetAddForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, name, role }: { userId: string; name: string; role: AppRole }) => {
      // Update profile name
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: name })
        .eq('id', userId);

      if (profileError) throw profileError;

      // Update role - first delete existing, then insert new
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (roleError) throw roleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users'] });
      toast({
        title: 'User Updated',
        description: 'User details have been updated successfully.',
      });
      setEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user',
        variant: 'destructive',
      });
    },
  });

  const resetAddForm = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('viewer');
  };

  const handleAddUser = () => {
    if (!newUserEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Email is required',
        variant: 'destructive',
      });
      return;
    }
    inviteUserMutation.mutate({
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
    });
  };

  const handleEditUser = (user: UserWithRole) => {
    setSelectedUser(user);
    setEditName(user.full_name || '');
    setEditEmail(user.email || '');
    setEditRole(user.role || 'viewer');
    setEditActive(user.is_active);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedUser) return;
    updateUserMutation.mutate({
      userId: selectedUser.id,
      name: editName,
      role: editRole,
    });
  };

  // Filter users by search query
  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    );
  });

  // Show loading while tenant context is initializing
  if (isTenantLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeTenant) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please select a tenant to manage users.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-accent" />
        <h2 className="text-xl font-semibold text-foreground">User Management</h2>
      </div>
      <p className="text-muted-foreground">
        Manage user accounts and assign roles for {activeTenant.name}.
      </p>

      {/* Search and Add */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {canManageUsers && (
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add User
          </Button>
        )}
      </div>

      {/* Users Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              {canManageUsers && <TableHead className="w-[80px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={canManageUsers ? 5 : 4} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManageUsers ? 5 : 4} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No users found matching your search.' : 'No users in this tenant yet.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name || '—'}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.role ? (
                      <Badge variant={roleBadgeVariants[user.role]}>
                        {roleLabels[user.role]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? 'default' : 'secondary'} className={user.is_active ? 'bg-green-600' : ''}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  {canManageUsers && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditUser(user)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pending Invites Section */}
      <PendingInvites tenantId={activeTenant.id} canManage={canManageUsers} />

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Invite New User
            </DialogTitle>
            <DialogDescription>
              Send an invitation to add a new user to {activeTenant.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                placeholder="John Doe"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="john@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-role">Role</Label>
              <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                An invitation email will be sent to the user.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddUser} disabled={inviteUserMutation.isPending}>
              {inviteUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Edit User
            </DialogTitle>
            <DialogDescription>
              Update user details and permissions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="edit-active">Active Status</Label>
                <p className="text-xs text-muted-foreground">Inactive users cannot log in.</p>
              </div>
              <Switch
                id="edit-active"
                checked={editActive}
                onCheckedChange={setEditActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Pending Invites Component
function PendingInvites({ tenantId, canManage }: { tenantId: string; canManage: boolean }) {
  const queryClient = useQueryClient();

  const { data: invites = [] } = useQuery({
    queryKey: ['tenant-invites', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_invites')
        .select('*')
        .eq('tenant_id', tenantId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('tenant_invites')
        .delete()
        .eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invites'] });
      toast({
        title: 'Invitation Cancelled',
        description: 'The invitation has been cancelled.',
      });
    },
  });

  if (invites.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Pending Invitations</h3>
      <div className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{invite.email}</p>
                <p className="text-xs text-muted-foreground">
                  Role: {roleLabels[invite.role as AppRole]} • 
                  Expires: {new Date(invite.expires_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteInviteMutation.mutate(invite.id)}
                disabled={deleteInviteMutation.isPending}
              >
                Cancel
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
