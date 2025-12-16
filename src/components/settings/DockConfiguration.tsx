import { useState } from 'react';
import { DockDoor, useDockDoors, useCreateDockDoor, useUpdateDockDoor, useDeleteDockDoor } from '@/hooks/useDockDoors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { DoorOpen, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

interface DockFormData {
  name: string;
  color: string;
}

export function DockConfiguration() {
  const { data: docks, isLoading } = useDockDoors();
  const createDock = useCreateDockDoor();
  const updateDock = useUpdateDockDoor();
  const deleteDock = useDeleteDockDoor();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDock, setEditingDock] = useState<DockDoor | null>(null);
  const [deleteConfirmDock, setDeleteConfirmDock] = useState<DockDoor | null>(null);
  const [formData, setFormData] = useState<DockFormData>({ name: '', color: '#3B82F6' });

  const openCreateDialog = () => {
    setEditingDock(null);
    setFormData({ name: '', color: '#3B82F6' });
    setIsDialogOpen(true);
  };

  const openEditDialog = (dock: DockDoor) => {
    setEditingDock(dock);
    setFormData({ name: dock.name, color: dock.color });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return;

    if (editingDock) {
      await updateDock.mutateAsync({ 
        id: editingDock.id, 
        name: formData.name.trim(), 
        color: formData.color 
      });
    } else {
      await createDock.mutateAsync({ 
        name: formData.name.trim(), 
        color: formData.color,
        is_active: true
      });
    }
    
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteConfirmDock) {
      await deleteDock.mutateAsync(deleteConfirmDock.id);
      setDeleteConfirmDock(null);
    }
  };

  const isSubmitting = createDock.isPending || updateDock.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <DoorOpen className="w-5 h-5 text-accent" />
            Dock Configuration
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your dock doors and their display colors on the calendar.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Dock
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      ) : docks && docks.length > 0 ? (
        <div className="grid gap-3">
          {docks.map((dock) => (
            <div
              key={dock.id}
              className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-md shadow-sm border border-border/50"
                  style={{ backgroundColor: dock.color }}
                />
                <span className="font-medium text-foreground">{dock.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(dock)}
                  title="Edit dock"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteConfirmDock(dock)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Delete dock"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <DoorOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No dock doors configured yet.</p>
          <p className="text-sm">Click "Add Dock" to create your first dock.</p>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDock ? 'Edit Dock' : 'Add New Dock'}
            </DialogTitle>
            <DialogDescription>
              {editingDock 
                ? 'Update the dock name and color.' 
                : 'Create a new dock door with a name and color.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dock-name">Dock Name</Label>
              <Input
                id="dock-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Dock 1, Loading Bay A"
                maxLength={50}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={cn(
                      'w-8 h-8 rounded-md transition-all border-2',
                      formData.color === color 
                        ? 'border-foreground scale-110 shadow-md' 
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="custom-color" className="text-xs text-muted-foreground">
                  Custom:
                </Label>
                <Input
                  id="custom-color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-12 h-8 p-1 cursor-pointer"
                />
                <span className="text-xs text-muted-foreground font-mono">
                  {formData.color}
                </span>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-md shadow-sm"
                  style={{ backgroundColor: formData.color }}
                />
                <span className="font-medium">
                  {formData.name || 'Dock Name'}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingDock ? 'Save Changes' : 'Create Dock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmDock} onOpenChange={() => setDeleteConfirmDock(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dock</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmDock?.name}"? 
              This action cannot be undone. Existing bookings assigned to this dock will no longer have a dock reference.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDock.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
