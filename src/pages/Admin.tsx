import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Building2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type AppRole = 'admin' | 'operator' | 'viewer' | 'super_user';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  tenant_id: string | null;
  created_at: string;
}

interface UserWithRole extends Profile {
  roles: { role: AppRole }[];
  tenant_name?: string;
  enrolled_tenants?: { id: string; tenant_id: string; tenant_name: string }[];
}

interface Tenant {
  id: string;
  name: string;
  created_at: string;
  user_count?: number;
}

export default function Admin() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('users');
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddTenantOpen, setIsAddTenantOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('viewer');
  const [newUserTenant, setNewUserTenant] = useState<string>('');
  const [newTenantName, setNewTenantName] = useState('');
  const [editPrimaryTenant, setEditPrimaryTenant] = useState<string>('unassigned');
  const [editRole, setEditRole] = useState<AppRole>('viewer');
  const [addTenantId, setAddTenantId] = useState<string>('');

  // Fetch all users with their roles and tenant info
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const [profilesResult, rolesResult, tenantsResult, enrollmentsResult] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('tenants').select('id, name'),
        supabase.from('user_tenants').select('id, user_id, tenant_id'),
      ]);
      
      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;
      if (tenantsResult.error) throw tenantsResult.error;

      const tenantMap = new Map(tenantsResult.data?.map(t => [t.id, t.name]));
      const roleMap = new Map<string, { role: AppRole }[]>();
      
      rolesResult.data?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push({ role: r.role as AppRole });
        roleMap.set(r.user_id, existing);
      });

      // Build enrollment map
      const enrollmentMap = new Map<string, { id: string; tenant_id: string; tenant_name: string }[]>();
      enrollmentsResult.data?.forEach(e => {
        const existing = enrollmentMap.get(e.user_id) || [];
        existing.push({
          id: e.id,
          tenant_id: e.tenant_id,
          tenant_name: tenantMap.get(e.tenant_id) || 'Unknown',
        });
        enrollmentMap.set(e.user_id, existing);
      });

      return profilesResult.data?.map(p => ({
        ...p,
        roles: roleMap.get(p.id) || [],
        tenant_name: p.tenant_id ? tenantMap.get(p.tenant_id) : undefined,
        enrolled_tenants: enrollmentMap.get(p.id) || [],
      })) as UserWithRole[];
    }
  });

  // Fetch all tenants with user counts
  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: async () => {
      const { data: tenantsList, error: tenantsError } = await supabase
        .from('tenants')
        .select('*');
      
      if (tenantsError) throw tenantsError;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('tenant_id');
      
      if (profilesError) throw profilesError;

      const countMap = new Map<string, number>();
      profiles?.forEach(p => {
        if (p.tenant_id) {
          countMap.set(p.tenant_id, (countMap.get(p.tenant_id) || 0) + 1);
        }
      });

      return tenantsList?.map(t => ({
        ...t,
        user_count: countMap.get(t.id) || 0
      })) as Tenant[];
    }
  });

  // Create new tenant
  const createTenantMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('tenants')
        .insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      setIsAddTenantOpen(false);
      setNewTenantName('');
      toast.success('Tenant created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create tenant: ' + error.message);
    }
  });

  // Update user's primary tenant and role
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, tenantId, role }: { userId: string; tenantId: string | null; role: AppRole }) => {
      // Prevent super_users from downgrading their own role
      const { data: currentUser } = await supabase.auth.getUser();
      if (currentUser?.user?.id === userId) {
        const { data: currentRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);
        const wasSuperUser = currentRoles?.some(r => r.role === 'super_user');
        if (wasSuperUser && role !== 'super_user') {
          throw new Error('Cannot downgrade your own super_user role. Ask another super user to make this change.');
        }
      }
      // Update profile's primary tenant
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ tenant_id: tenantId })
        .eq('id', userId);
      
      if (profileError) throw profileError;

      // Delete existing roles and add new one
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });
      
      if (insertError) throw insertError;

      // Ensure the primary tenant is also in user_tenants
      if (tenantId) {
        await supabase
          .from('user_tenants')
          .upsert({ user_id: userId, tenant_id: tenantId }, { onConflict: 'user_id,tenant_id' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
      setIsEditUserOpen(false);
      setSelectedUser(null);
      toast.success('User updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update user: ' + error.message);
    }
  });

  // Add tenant enrollment
  const addEnrollmentMutation = useMutation({
    mutationFn: async ({ userId, tenantId }: { userId: string; tenantId: string }) => {
      const { error } = await supabase
        .from('user_tenants')
        .insert({ user_id: userId, tenant_id: tenantId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setAddTenantId('');
      toast.success('Tenant enrollment added');
    },
    onError: (error) => {
      toast.error('Failed to add enrollment: ' + error.message);
    }
  });

  // Remove tenant enrollment
  const removeEnrollmentMutation = useMutation({
    mutationFn: async ({ enrollmentId, userId, tenantId }: { enrollmentId: string; userId: string; tenantId: string }) => {
      const { error } = await supabase
        .from('user_tenants')
        .delete()
        .eq('id', enrollmentId);
      if (error) throw error;

      // If removing the primary tenant, clear it from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', userId)
        .single();
      
      if (profile?.tenant_id === tenantId) {
        await supabase
          .from('profiles')
          .update({ tenant_id: null })
          .eq('id', userId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Tenant enrollment removed');
    },
    onError: (error) => {
      toast.error('Failed to remove enrollment: ' + error.message);
    }
  });

  // Create tenant invite
  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, tenantId, role }: { email: string; tenantId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('tenant_invites')
        .insert({ 
          email, 
          tenant_id: tenantId, 
          role 
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsAddUserOpen(false);
      setNewUserEmail('');
      setNewUserRole('viewer');
      setNewUserTenant('');
      toast.success('User invitation created');
    },
    onError: (error) => {
      toast.error('Failed to invite user: ' + error.message);
    }
  });

  const handleEditUser = (user: UserWithRole) => {
    setSelectedUser(user);
    setEditPrimaryTenant(user.tenant_id || 'unassigned');
    setEditRole(user.roles[0]?.role || 'viewer');
    setAddTenantId('');
    setIsEditUserOpen(true);
  };

  // Keep selectedUser in sync when users data refreshes (e.g. after adding/removing enrollments)
  useEffect(() => {
    if (selectedUser && users) {
      const updated = users.find(u => u.id === selectedUser.id);
      if (updated) {
        setSelectedUser(updated);
        setEditPrimaryTenant(updated.tenant_id || 'unassigned');
      }
    }
  }, [users]);

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'super_user': return 'destructive';
      case 'admin': return 'default';
      case 'operator': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground">Manage users and tenants across the system</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="tenants" className="gap-2">
              <Building2 className="h-4 w-4" />
              Tenants
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Users</CardTitle>
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Invite User
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite New User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input 
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="user@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tenant</Label>
                        <Select value={newUserTenant} onValueChange={setNewUserTenant}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tenant" />
                          </SelectTrigger>
                          <SelectContent>
                            {tenants?.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as AppRole)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="operator">Operator</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="super_user">Super User</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={() => inviteUserMutation.mutate({ 
                          email: newUserEmail, 
                          tenantId: newUserTenant, 
                          role: newUserRole 
                        })}
                        disabled={!newUserEmail || !newUserTenant || inviteUserMutation.isPending}
                      >
                        Send Invitation
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading users...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map(user => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            {user.full_name || '—'}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {user.roles.map((r, i) => (
                              <Badge key={i} variant={getRoleBadgeVariant(r.role)} className="mr-1">
                                {r.role}
                              </Badge>
                            ))}
                            {user.roles.length === 0 && <span className="text-muted-foreground">No role</span>}
                          </TableCell>
                          <TableCell>
                            {user.enrolled_tenants && user.enrolled_tenants.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {user.enrolled_tenants.map(et => (
                                  <Badge key={et.id} variant={et.tenant_id === user.tenant_id ? 'default' : 'outline'} className="text-xs">
                                    {et.tenant_name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleEditUser(user)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tenants">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Tenants</CardTitle>
                <Dialog open={isAddTenantOpen} onOpenChange={setIsAddTenantOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add Tenant
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Tenant</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Tenant Name</Label>
                        <Input 
                          value={newTenantName}
                          onChange={(e) => setNewTenantName(e.target.value)}
                          placeholder="Acme Warehouse"
                        />
                      </div>
                      <Button 
                        className="w-full" 
                        onClick={() => createTenantMutation.mutate(newTenantName)}
                        disabled={!newTenantName || createTenantMutation.isPending}
                      >
                        Create Tenant
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {tenantsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading tenants...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Users</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tenants?.map(tenant => (
                        <TableRow key={tenant.id}>
                          <TableCell className="font-medium">{tenant.name}</TableCell>
                          <TableCell>{format(new Date(tenant.created_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{tenant.user_count} users</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit User Dialog */}
        <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4 py-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>

                {/* Enrolled Tenants */}
                <div className="space-y-2">
                  <Label>Enrolled Tenants</Label>
                  <div className="space-y-2">
                    {selectedUser.enrolled_tenants && selectedUser.enrolled_tenants.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedUser.enrolled_tenants.map(et => (
                          <Badge key={et.id} variant={et.tenant_id === selectedUser.tenant_id ? 'default' : 'secondary'} className="flex items-center gap-1 py-1">
                            {et.tenant_name}
                            {et.tenant_id === selectedUser.tenant_id && (
                              <span className="text-[10px] opacity-70">(primary)</span>
                            )}
                            <button
                              onClick={() => removeEnrollmentMutation.mutate({
                                enrollmentId: et.id,
                                userId: selectedUser.id,
                                tenantId: et.tenant_id,
                              })}
                              className="ml-1 hover:text-destructive"
                              disabled={removeEnrollmentMutation.isPending}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No tenants enrolled</p>
                    )}
                    
                    {/* Add tenant enrollment */}
                    <div className="flex gap-2">
                      <Select value={addTenantId} onValueChange={setAddTenantId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Add tenant..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tenants?.filter(t => 
                            !selectedUser.enrolled_tenants?.some(et => et.tenant_id === t.id)
                          ).map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (addTenantId) {
                            addEnrollmentMutation.mutate({
                              userId: selectedUser.id,
                              tenantId: addTenantId,
                            });
                          }
                        }}
                        disabled={!addTenantId || addEnrollmentMutation.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Primary Tenant */}
                <div className="space-y-2">
                  <Label>Primary Tenant</Label>
                  <Select value={editPrimaryTenant} onValueChange={setEditPrimaryTenant}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary tenant" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {(selectedUser.enrolled_tenants || []).map(et => (
                        <SelectItem key={et.tenant_id} value={et.tenant_id}>{et.tenant_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">The primary tenant determines which tenant loads by default</p>
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="super_user">Super User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => updateUserMutation.mutate({ 
                    userId: selectedUser.id, 
                    tenantId: editPrimaryTenant === 'unassigned' ? null : editPrimaryTenant || null, 
                    role: editRole 
                  })}
                  disabled={updateUserMutation.isPending}
                >
                  Save Changes
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
