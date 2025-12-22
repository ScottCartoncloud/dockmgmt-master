import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContext } from '@/hooks/useTenantContext';
import { useCarriers, Carrier } from '@/hooks/useCarriers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { 
  Truck, 
  Search, 
  Plus, 
  Pencil, 
  Loader2, 
  Copy, 
  RefreshCw,
  Link2,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const ITEMS_PER_PAGE = 10;

export function CarrierManagement() {
  const { isAdmin, isSuperUser } = useAuth();
  const { activeTenant, isLoading: isTenantLoading } = useTenantContext();
  const { 
    carriers, 
    isLoading, 
    createCarrier, 
    updateCarrier, 
    deleteCarrier,
    toggleBookingLink, 
    resetBookingLink 
  } = useCarriers();
  
  const canManageCarriers = isAdmin || isSuperUser;

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<Carrier | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');

  // Filter carriers by search query
  const filteredCarriers = useMemo(() => {
    return carriers.filter(carrier => {
      const searchLower = searchQuery.toLowerCase();
      return (
        carrier.name.toLowerCase().includes(searchLower) ||
        carrier.email?.toLowerCase().includes(searchLower)
      );
    });
  }, [carriers, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredCarriers.length / ITEMS_PER_PAGE);
  const paginatedCarriers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredCarriers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCarriers, currentPage]);

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
  };

  const handleAddCarrier = () => {
    if (!formName.trim()) {
      toast({
        title: 'Error',
        description: 'Carrier name is required',
        variant: 'destructive',
      });
      return;
    }
    createCarrier.mutate({ name: formName, email: formEmail || undefined }, {
      onSuccess: () => {
        setAddDialogOpen(false);
        resetForm();
      },
    });
  };

  const handleEditCarrier = (carrier: Carrier) => {
    setSelectedCarrier(carrier);
    setFormName(carrier.name);
    setFormEmail(carrier.email || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedCarrier || !formName.trim()) return;
    updateCarrier.mutate({ 
      id: selectedCarrier.id, 
      name: formName, 
      email: formEmail || undefined 
    }, {
      onSuccess: () => {
        setEditDialogOpen(false);
        setSelectedCarrier(null);
        resetForm();
      },
    });
  };

  const handleToggleLink = (carrier: Carrier) => {
    toggleBookingLink.mutate({ 
      carrierId: carrier.id, 
      enabled: !carrier.is_booking_link_enabled 
    });
  };

  const handleResetLink = (carrier: Carrier) => {
    setSelectedCarrier(carrier);
    setResetDialogOpen(true);
  };

  const confirmResetLink = () => {
    if (!selectedCarrier) return;
    resetBookingLink.mutate(selectedCarrier.id, {
      onSuccess: () => {
        setResetDialogOpen(false);
        setSelectedCarrier(null);
      },
    });
  };

  const handleDeleteCarrier = (carrier: Carrier) => {
    setSelectedCarrier(carrier);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedCarrier) return;
    deleteCarrier.mutate(selectedCarrier.id, {
      onSuccess: () => {
        setDeleteDialogOpen(false);
        setSelectedCarrier(null);
      },
    });
  };

  const copyBookingLink = (carrier: Carrier) => {
    const url = `${window.location.origin}/carrier/${carrier.booking_link_id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copied',
      description: 'Booking link copied to clipboard.',
    });
  };

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
        Please select a tenant to manage carriers.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Truck className="w-5 h-5 text-accent" />
        <h2 className="text-xl font-semibold text-foreground">Carrier Management</h2>
      </div>
      <p className="text-muted-foreground">
        Manage carriers and their booking links for {activeTenant.name}.
      </p>

      {/* Search and Add */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search carriers..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        {canManageCarriers && (
          <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Carrier
          </Button>
        )}
      </div>

      {/* Carriers Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Booking Link</TableHead>
              <TableHead className="text-center">Link Status</TableHead>
              {canManageCarriers && <TableHead className="w-[180px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={canManageCarriers ? 5 : 4} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : paginatedCarriers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManageCarriers ? 5 : 4} className="text-center py-8 text-muted-foreground">
                  {searchQuery ? 'No carriers found matching your search.' : 'No carriers added yet.'}
                </TableCell>
              </TableRow>
            ) : (
              paginatedCarriers.map((carrier) => (
                <TableRow key={carrier.id}>
                  <TableCell className="font-medium">{carrier.name}</TableCell>
                  <TableCell>{carrier.email || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[200px]">
                        /carrier/{carrier.booking_link_id.slice(0, 8)}...
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => copyBookingLink(carrier)}
                        title="Copy link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => window.open(`/carrier/${carrier.booking_link_id}`, '_blank')}
                        title="Open link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={carrier.is_booking_link_enabled}
                      onCheckedChange={() => handleToggleLink(carrier)}
                      disabled={!canManageCarriers}
                    />
                  </TableCell>
                  {canManageCarriers && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditCarrier(carrier)}
                          title="Edit carrier"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleResetLink(carrier)}
                          title="Reset booking link"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCarrier(carrier)}
                          title="Delete carrier"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <PaginationItem key={page}>
                <PaginationLink
                  onClick={() => setCurrentPage(page)}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      {/* Add Carrier Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              Add New Carrier
            </DialogTitle>
            <DialogDescription>
              Add a new carrier to generate a booking link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="carrier-name">Name *</Label>
              <Input
                id="carrier-name"
                placeholder="Carrier name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="carrier-email">Email (optional)</Label>
              <Input
                id="carrier-email"
                type="email"
                placeholder="carrier@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used for default booking notifications.
              </p>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Link2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                A unique booking link will be generated automatically.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddCarrier} disabled={createCarrier.isPending}>
              {createCarrier.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Carrier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Carrier Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Edit Carrier
            </DialogTitle>
            <DialogDescription>
              Update carrier details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-carrier-name">Name *</Label>
              <Input
                id="edit-carrier-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-carrier-email">Email (optional)</Label>
              <Input
                id="edit-carrier-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateCarrier.isPending}>
              {updateCarrier.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Link Confirmation */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Booking Link?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a new booking link for <strong>{selectedCarrier?.name}</strong>. 
              The old link will no longer work. Any existing bookings will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetLink}>
              Reset Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Carrier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{selectedCarrier?.name}</strong> and their booking link. 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
