import { useState, useEffect, useMemo } from 'react';
import { CrossDockBooking, CartonCloudPO, CustomFieldValues } from '@/types/booking';
import { format, parse } from 'date-fns';
import { X, Search, Package, ExternalLink, Trash2, Loader2, Check, ChevronsUpDown, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSearchCartonCloudOrders, useCartonCloudSettings } from '@/hooks/useCartonCloudSettings';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { useDockDoors } from '@/hooks/useDockDoors';
import { useActiveCustomBookingFields } from '@/hooks/useCustomBookingFields';
import { CustomFieldsRenderer } from '@/components/CustomFieldsRenderer';
import { useCarriers, Carrier } from '@/hooks/useCarriers';

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (booking: Partial<CrossDockBooking>) => void;
  onDelete?: (id: string) => void;
  booking?: CrossDockBooking | null;
  defaultDate?: Date;
  defaultHour?: number;
  defaultDockNumber?: number;
}

export function BookingModal({
  open,
  onClose,
  onSave,
  onDelete,
  booking,
  defaultDate,
  defaultHour,
  defaultDockNumber,
}: BookingModalProps) {
  const [title, setTitle] = useState('');
  const [pallets, setPallets] = useState<string>('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [carrierName, setCarrierName] = useState('');
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(null);
  const [carrierSearchOpen, setCarrierSearchOpen] = useState(false);
  const [carrierSearchTerm, setCarrierSearchTerm] = useState('');
  const [truckRego, setTruckRego] = useState('');
  const [selectedDockId, setSelectedDockId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<CrossDockBooking['status']>('scheduled');
  const [selectedPO, setSelectedPO] = useState<CartonCloudPO | null>(null);
  const [poSearchOpen, setPoSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CartonCloudPO[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<CustomFieldValues>({});

  const { data: cartonCloudSettings } = useCartonCloudSettings();
  const { data: dockDoors } = useDockDoors();
  const { data: customFields } = useActiveCustomBookingFields();
  const { carriers } = useCarriers();
  const searchOrders = useSearchCartonCloudOrders();
  const isCartonCloudConnected = !!cartonCloudSettings;
  const activeDocks = useMemo(() => (dockDoors || []).filter((d) => d.is_active), [dockDoors]);
  
  // Filter carriers based on search term
  const filteredCarriers = useMemo(() => {
    if (!carrierSearchTerm.trim()) return carriers;
    const term = carrierSearchTerm.toLowerCase();
    return carriers.filter((c) => c.name.toLowerCase().includes(term));
  }, [carriers, carrierSearchTerm]);

  const isEditing = !!booking;

  const debouncedSearch = useDebouncedCallback((term: string) => {
    if (term.length >= 2 && isCartonCloudConnected) {
      searchOrders.mutate(term, {
        onSuccess: (results) => {
          setSearchResults(results);
        },
        onError: () => {
          setSearchResults([]);
        },
      });
    } else {
      setSearchResults([]);
    }
  }, 300);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    if (booking) {
      setTitle(booking.title);
      setPallets(booking.pallets?.toString() || '');
      setDate(format(booking.date, 'yyyy-MM-dd'));
      setStartTime(booking.startTime);
      setEndTime(booking.endTime);
      setCarrierName(booking.carrier);
      setSelectedCarrierId(booking.carrierId || null);
      setTruckRego(booking.truckRego || '');
      // Find dock ID from booking's dock_door_id
      setSelectedDockId(booking.dockDoorId || '');
      setNotes(booking.notes || '');
      setStatus(booking.status);
      setSelectedPO(booking.cartonCloudPO || null);
      setCustomFieldValues(booking.customFields || {});
    } else {
      // Reset form for new booking
      setTitle('');
      setPallets('');
      setDate(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setStartTime(defaultHour ? `${defaultHour.toString().padStart(2, '0')}:00` : '09:00');
      setEndTime(defaultHour ? `${(defaultHour + 1).toString().padStart(2, '0')}:00` : '10:00');
      setCarrierName('');
      setSelectedCarrierId(null);
      setTruckRego('');
      // Find dock ID from defaultDockNumber
      const defaultDock = defaultDockNumber ? activeDocks.find(d => {
        const num = parseInt(d.name.replace(/\D/g, ''), 10);
        return num === defaultDockNumber;
      }) : null;
      setSelectedDockId(defaultDock?.id || '');
      setNotes('');
      setStatus('scheduled');
      setSelectedPO(null);
      setCustomFieldValues({});
    }
    setSearchTerm('');
    setSearchResults([]);
    setCarrierSearchTerm('');
  }, [booking, defaultDate, defaultHour, defaultDockNumber, open, activeDocks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check required custom fields
    const missingRequired = customFields?.filter(field => {
      if (!field.is_required) return false;
      const value = customFieldValues[field.id];
      if (value === null || value === undefined) return true;
      if (typeof value === 'string' && !value.trim()) return true;
      if (Array.isArray(value) && value.length === 0) return true;
      return false;
    });
    
    if (missingRequired && missingRequired.length > 0) {
      // Could show validation toast here
      return;
    }
    
    // Get dock number from selected dock for display purposes
    const selectedDock = activeDocks.find(d => d.id === selectedDockId);
    const dockNumber = selectedDock ? parseInt(selectedDock.name.replace(/\D/g, ''), 10) || undefined : undefined;
    
    // Parse pallets as integer (only valid if it's a whole number >= 0)
    const palletsValue = pallets.trim() === '' ? undefined : parseInt(pallets, 10);
    const validPallets = palletsValue !== undefined && !isNaN(palletsValue) && palletsValue >= 0 ? palletsValue : undefined;
    
    onSave({
      id: booking?.id,
      title: title || (selectedPO ? `${selectedPO.customer} Delivery` : 'New Booking'),
      // Parse as a *local* date to avoid timezone shifting (e.g. North America seeing prior day)
      date: parse(date, 'yyyy-MM-dd', new Date()),
      startTime,
      endTime,
      carrier: carrierName,
      carrierId: selectedCarrierId || undefined,
      truckRego: truckRego || undefined,
      pallets: validPallets,
      dockNumber,
      dockDoorId: selectedDockId || undefined,
      purchaseOrderId: selectedPO?.id,
      cartonCloudPO: selectedPO || undefined,
      notes: notes || undefined,
      status,
      customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
    });
    
    onClose();
  };

  const handleDelete = () => {
    if (booking && onDelete) {
      onDelete(booking.id);
      onClose();
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ALLOCATED':
      case 'IN_TRANSIT':
        return 'default';
      case 'VERIFIED':
      case 'COMPLETED':
        return 'secondary';
      case 'DRAFT':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEditing ? 'Edit Booking' : 'New Cross Dock Booking'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* PO Search */}
          <div className="space-y-2">
            <Label>Link to CartonCloud PO</Label>
            {!isCartonCloudConnected ? (
              <div className="p-3 bg-muted/50 border border-border rounded-md text-sm text-muted-foreground">
                CartonCloud is not connected. Configure it in Settings → Integration to search for Purchase Orders.
              </div>
            ) : (
              <>
                <Popover open={poSearchOpen} onOpenChange={setPoSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      {selectedPO ? (
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-accent" />
                          <span>PO: {selectedPO.reference}</span>
                          <span className="text-muted-foreground">- {selectedPO.customer}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Search className="w-4 h-4" />
                          <span>Search Purchase Orders...</span>
                        </div>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Type PO reference number..." 
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                      />
                      <CommandList>
                        {searchOrders.isPending && (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                          </div>
                        )}
                        {!searchOrders.isPending && searchTerm.length < 2 && (
                          <div className="py-4 text-center text-sm text-muted-foreground">
                            Type at least 2 characters to search
                          </div>
                        )}
                        {!searchOrders.isPending && searchTerm.length >= 2 && searchResults.length === 0 && (
                          <CommandEmpty>No purchase orders found.</CommandEmpty>
                        )}
                        {searchResults.length > 0 && (
                          <CommandGroup>
                            {searchResults.map((po) => (
                              <CommandItem
                                key={po.id}
                                onSelect={() => {
                                  setSelectedPO(po);
                                  setPoSearchOpen(false);
                                  if (!title) {
                                    setTitle(`${po.customer} Delivery`);
                                  }
                                }}
                                className="cursor-pointer"
                              >
                                <div className="flex flex-col gap-1 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">PO: {po.reference}</span>
                                    <Badge variant={getStatusBadgeVariant(po.status)} className="text-xs">
                                      {po.status}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {po.customer} • {po.itemCount} items
                                    {po.arrivalDate && ` • ETA: ${po.arrivalDate}`}
                                  </div>
                                </div>
                                <ExternalLink className="w-4 h-4 text-muted-foreground" />
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedPO && (
                  <div className="flex items-center justify-between p-3 bg-accent/5 border border-accent/20 rounded-md">
                    <div className="space-y-1">
                      <div className="font-medium text-sm">PO: {selectedPO.reference}</div>
                      <div className="text-xs text-muted-foreground">
                        {selectedPO.customer} • {selectedPO.status}
                        {selectedPO.arrivalDate && ` • ETA: ${selectedPO.arrivalDate}`}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPO(null)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Booking Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fresh Foods Delivery"
            />
          </div>

          {/* Pallets */}
          <div className="space-y-2">
            <Label htmlFor="pallets"># of Pallets</Label>
            <Input
              id="pallets"
              type="number"
              min="0"
              step="1"
              value={pallets}
              onChange={(e) => {
                const value = e.target.value;
                // Only allow whole numbers
                if (value === '' || /^\d+$/.test(value)) {
                  setPallets(value);
                }
              }}
              placeholder="e.g., 12"
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Carrier and Truck */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Popover open={carrierSearchOpen} onOpenChange={setCarrierSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={carrierSearchOpen}
                    className="w-full justify-between font-normal"
                  >
                    {carrierName ? (
                      <div className="flex items-center gap-2 truncate">
                        <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{carrierName}</span>
                        {selectedCarrierId && (
                          <Badge variant="secondary" className="text-xs shrink-0">Saved</Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select or type carrier...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search or type carrier name..."
                      value={carrierSearchTerm}
                      onValueChange={(value) => {
                        setCarrierSearchTerm(value);
                        // Always update carrier name as user types
                        setCarrierName(value);
                        setSelectedCarrierId(null); // Clear selection when typing
                      }}
                    />
                    <CommandList>
                      {filteredCarriers.length === 0 && !carrierSearchTerm.trim() && (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          No carriers saved. Type to add one.
                        </div>
                      )}
                      {carrierSearchTerm.trim() && filteredCarriers.length === 0 && (
                        <CommandItem
                          onSelect={() => {
                            setCarrierName(carrierSearchTerm.trim());
                            setSelectedCarrierId(null);
                            setCarrierSearchOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            <span>Use "{carrierSearchTerm.trim()}"</span>
                          </div>
                        </CommandItem>
                      )}
                      {filteredCarriers.length > 0 && (
                        <CommandGroup heading="Saved Carriers">
                          {filteredCarriers.map((c) => (
                            <CommandItem
                              key={c.id}
                              onSelect={() => {
                                setCarrierName(c.name);
                                setSelectedCarrierId(c.id);
                                setCarrierSearchOpen(false);
                                setCarrierSearchTerm('');
                              }}
                              className="cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCarrierId === c.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <Truck className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>{c.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                      {carrierSearchTerm.trim() && filteredCarriers.length > 0 && !filteredCarriers.some(c => c.name.toLowerCase() === carrierSearchTerm.toLowerCase()) && (
                        <CommandGroup heading="Custom">
                          <CommandItem
                            onSelect={() => {
                              setCarrierName(carrierSearchTerm.trim());
                              setSelectedCarrierId(null);
                              setCarrierSearchOpen(false);
                            }}
                            className="cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4" />
                              <span>Use "{carrierSearchTerm.trim()}"</span>
                            </div>
                          </CommandItem>
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {carrierName && !selectedCarrierId && (
                <p className="text-xs text-muted-foreground">
                  Custom carrier (not saved to your carriers list)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="truckRego">Truck Rego</Label>
              <Input
                id="truckRego"
                value={truckRego}
                onChange={(e) => setTruckRego(e.target.value)}
                placeholder="e.g., ABC-123"
              />
            </div>
          </div>

          {/* Dock and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dock</Label>
              <Select value={selectedDockId} onValueChange={setSelectedDockId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dock">
                    {selectedDockId && activeDocks.find(d => d.id === selectedDockId) && (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: activeDocks.find(d => d.id === selectedDockId)?.color }}
                        />
                        {activeDocks.find(d => d.id === selectedDockId)?.name}
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {activeDocks.map((dock) => (
                    <SelectItem key={dock.id} value={dock.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: dock.color }}
                        />
                        {dock.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CrossDockBooking['status'])}>
                <SelectTrigger>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        status === 'scheduled' && "bg-accent",
                        status === 'arrived' && "bg-success",
                        status === 'in_progress' && "bg-accent",
                        status === 'completed' && "bg-muted-foreground",
                        status === 'cancelled' && "bg-destructive"
                      )} />
                      <span className="capitalize">{status.replace('_', ' ')}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                      Scheduled
                    </div>
                  </SelectItem>
                  <SelectItem value="arrived">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-success" />
                      Arrived
                    </div>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                      In Progress
                    </div>
                  </SelectItem>
                  <SelectItem value="completed">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
                      Completed
                    </div>
                  </SelectItem>
                  <SelectItem value="cancelled">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
                      Cancelled
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom Fields */}
          {customFields && customFields.length > 0 && (
            <CustomFieldsRenderer
              fields={customFields}
              values={customFieldValues}
              onChange={setCustomFieldValues}
            />
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            {isEditing && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <div className={cn('flex gap-3', !isEditing && 'ml-auto')}>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="bg-accent text-accent-foreground hover:bg-accent/90">
                {isEditing ? 'Save Changes' : 'Create Booking'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
