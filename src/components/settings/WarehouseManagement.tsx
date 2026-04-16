import { useState } from 'react';
import { Warehouse, useWarehouses, useCreateWarehouse, useUpdateWarehouse, useDeleteWarehouse, useSetDefaultWarehouse } from '@/hooks/useWarehouses';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Warehouse as WarehouseIcon, Plus, Pencil, Trash2, Loader2, Star } from 'lucide-react';

interface FormData {
  name: string;
  cartoncloud_warehouse_id: string;
}

export function WarehouseManagement() {
  const { warehouses, isLoading } = useWarehouses();
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const deleteWarehouse = useDeleteWarehouse();
  const setDefault = useSetDefaultWarehouse();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: '', cartoncloud_warehouse_id: '' });

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', cartoncloud_warehouse_id: '' });
    setIsDialogOpen(true);
  };

  const openEdit = (w: Warehouse) => {
    setEditing(w);
    setFormData({ name: w.name, cartoncloud_warehouse_id: w.cartoncloud_warehouse_id });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.cartoncloud_warehouse_id.trim()) return;

    if (editing) {
      await updateWarehouse.mutateAsync({
        id: editing.id,
        name: formData.name.trim(),
        cartoncloud_warehouse_id: formData.cartoncloud_warehouse_id.trim(),
      });
    } else {
      await createWarehouse.mutateAsync({
        name: formData.name.trim(),
        cartoncloud_warehouse_id: formData.cartoncloud_warehouse_id.trim(),
      });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteWarehouse.mutateAsync(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  const isSubmitting = createWarehouse.isPending || updateWarehouse.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <WarehouseIcon className="w-5 h-5 text-accent" />
            Warehouses
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage warehouses and assign docks to them.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Warehouse
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : warehouses.length > 0 ? (
        <div className="grid gap-3">
          {warehouses.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <WarehouseIcon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{w.name}</span>
                    {w.is_default && (
                      <Badge variant="secondary" className="text-xs">Default</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">CC ID: {w.cartoncloud_warehouse_id}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!w.is_default && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDefault.mutate(w.id)}
                    disabled={setDefault.isPending}
                    title="Set as default"
                    className="gap-1 text-xs"
                  >
                    <Star className="w-3.5 h-3.5" />
                    Set Default
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => openEdit(w)} title="Edit warehouse">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteConfirm(w)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete warehouse"
                  disabled={w.is_default && warehouses.length === 1}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <WarehouseIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No warehouses configured yet.</p>
          <p className="text-sm">Click "Add Warehouse" to create your first warehouse.</p>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Warehouse' : 'Add New Warehouse'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update the warehouse details.' : 'Create a new warehouse with a name and CartonCloud Warehouse ID.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wh-name">Name</Label>
              <Input
                id="wh-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Main Warehouse"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-cc-id">CartonCloud Warehouse ID</Label>
              <Input
                id="wh-cc-id"
                value={formData.cartoncloud_warehouse_id}
                onChange={(e) => setFormData({ ...formData, cartoncloud_warehouse_id: e.target.value })}
                placeholder="e.g., 12345"
                required
              />
              <p className="text-xs text-muted-foreground">
                The warehouse ID from your CartonCloud account. This is used to link orders to the correct warehouse.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !formData.name.trim() || !formData.cartoncloud_warehouse_id.trim()}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editing ? 'Save Changes' : 'Create Warehouse'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Warehouse</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"?
              This action cannot be undone. Warehouses with assigned docks cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteWarehouse.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
