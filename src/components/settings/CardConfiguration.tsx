import { useState } from 'react';
import { 
  LayoutGrid, 
  Plus, 
  Pencil, 
  Trash2, 
  GripVertical, 
  ChevronUp, 
  ChevronDown,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useCustomBookingFields,
  useCreateCustomBookingField,
  useUpdateCustomBookingField,
  useDeleteCustomBookingField,
  useReorderCustomBookingFields,
  CustomBookingField,
  FieldType,
} from '@/hooks/useCustomBookingFields';

const fieldTypeLabels: Record<FieldType, string> = {
  text: 'Text Input',
  dropdown: 'Dropdown',
  multiselect: 'Multi-select',
  date: 'Date Picker',
};

export function CardConfiguration() {
  const { data: fields, isLoading } = useCustomBookingFields();
  const createField = useCreateCustomBookingField();
  const updateField = useUpdateCustomBookingField();
  const deleteField = useDeleteCustomBookingField();
  const reorderFields = useReorderCustomBookingFields();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomBookingField | null>(null);
  
  // Form state
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [isRequired, setIsRequired] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');

  const resetForm = () => {
    setLabel('');
    setFieldType('text');
    setIsRequired(false);
    setIsActive(true);
    setOptions([]);
    setNewOption('');
    setEditingField(null);
  };

  const openNewDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (field: CustomBookingField) => {
    setEditingField(field);
    setLabel(field.label);
    setFieldType(field.field_type);
    setIsRequired(field.is_required);
    setIsActive(field.is_active);
    setOptions(field.options || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!label.trim()) return;

    const fieldData = {
      label: label.trim(),
      field_type: fieldType,
      is_required: isRequired,
      is_active: isActive,
      options: ['dropdown', 'multiselect'].includes(fieldType) ? options : [],
    };

    if (editingField) {
      await updateField.mutateAsync({ id: editingField.id, ...fieldData });
    } else {
      await createField.mutateAsync(fieldData);
    }
    
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await deleteField.mutateAsync(id);
  };

  const addOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const moveOptionUp = (index: number) => {
    if (index === 0) return;
    const newOptions = [...options];
    [newOptions[index - 1], newOptions[index]] = [newOptions[index], newOptions[index - 1]];
    setOptions(newOptions);
  };

  const moveOptionDown = (index: number) => {
    if (index === options.length - 1) return;
    const newOptions = [...options];
    [newOptions[index], newOptions[index + 1]] = [newOptions[index + 1], newOptions[index]];
    setOptions(newOptions);
  };

  const moveFieldUp = async (index: number) => {
    if (!fields || index === 0) return;
    const newOrder = [...fields];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    await reorderFields.mutateAsync(newOrder.map(f => f.id));
  };

  const moveFieldDown = async (index: number) => {
    if (!fields || index === fields.length - 1) return;
    const newOrder = [...fields];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    await reorderFields.mutateAsync(newOrder.map(f => f.id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-semibold text-foreground">Card Configuration</h2>
        </div>
        <Button onClick={openNewDialog} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Add Field
        </Button>
      </div>

      <p className="text-muted-foreground">
        Customize fields shown in the booking modal. Drag to reorder, toggle visibility, or edit properties.
      </p>

      {/* Fields list */}
      <div className="space-y-2">
        {fields?.length === 0 && (
          <div className="p-8 border-2 border-dashed border-border rounded-lg text-center text-muted-foreground">
            No custom fields configured. Click "Add Field" to create one.
          </div>
        )}
        
        {fields?.map((field, index) => (
          <div
            key={field.id}
            className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border group"
          >
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => moveFieldUp(index)}
                disabled={index === 0 || reorderFields.isPending}
              >
                <ChevronUp className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => moveFieldDown(index)}
                disabled={index === (fields?.length || 0) - 1 || reorderFields.isPending}
              >
                <ChevronDown className="w-3 h-3" />
              </Button>
            </div>
            
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{field.label}</span>
                {field.is_required && (
                  <Badge variant="outline" className="text-xs">Required</Badge>
                )}
                {!field.is_active && (
                  <Badge variant="secondary" className="text-xs">Inactive</Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <span>{fieldTypeLabels[field.field_type]}</span>
                {field.options && field.options.length > 0 && (
                  <span>• {field.options.length} options</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(field)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete "{field.label}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently remove this custom field. Existing booking data for this field will be preserved but no longer displayed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(field.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Field Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingField ? 'Edit Field' : 'Add Custom Field'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">Field Label</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Temperature Requirements"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Field Type</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Input</SelectItem>
                  <SelectItem value="dropdown">Dropdown (Single Select)</SelectItem>
                  <SelectItem value="multiselect">Multi-select</SelectItem>
                  <SelectItem value="date">Date Picker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Options for dropdown/multiselect */}
            {['dropdown', 'multiselect'].includes(fieldType) && (
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="flex gap-2">
                  <Input
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Add an option..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
                  />
                  <Button type="button" onClick={addOption} size="sm">
                    Add
                  </Button>
                </div>
                
                {options.length > 0 && (
                  <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
                    {options.map((option, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm"
                      >
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => moveOptionUp(index)}
                            disabled={index === 0}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4"
                            onClick={() => moveOptionDown(index)}
                            disabled={index === options.length - 1}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <span className="flex-1">{option}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeOption(index)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="required">Required Field</Label>
                <p className="text-sm text-muted-foreground">
                  Users must fill this field to save
                </p>
              </div>
              <Switch
                id="required"
                checked={isRequired}
                onCheckedChange={setIsRequired}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Show this field in the booking modal
                </p>
              </div>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={!label.trim() || createField.isPending || updateField.isPending}
            >
              {(createField.isPending || updateField.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingField ? 'Save Changes' : 'Add Field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
