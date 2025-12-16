import { useState, useEffect } from 'react';
import { CrossDockBooking, PurchaseOrder } from '@/types/booking';
import { mockPurchaseOrders, DOCK_NUMBERS } from '@/data/mockData';
import { format, setHours } from 'date-fns';
import { X, Search, Package, ExternalLink, Trash2 } from 'lucide-react';
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

interface BookingModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (booking: Partial<CrossDockBooking>) => void;
  onDelete?: (id: string) => void;
  booking?: CrossDockBooking | null;
  defaultDate?: Date;
  defaultHour?: number;
}

export function BookingModal({
  open,
  onClose,
  onSave,
  onDelete,
  booking,
  defaultDate,
  defaultHour,
}: BookingModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [carrier, setCarrier] = useState('');
  const [truckRego, setTruckRego] = useState('');
  const [dockNumber, setDockNumber] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<CrossDockBooking['status']>('scheduled');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poSearchOpen, setPoSearchOpen] = useState(false);

  const isEditing = !!booking;

  useEffect(() => {
    if (booking) {
      setTitle(booking.title);
      setDate(format(booking.date, 'yyyy-MM-dd'));
      setStartTime(booking.startTime);
      setEndTime(booking.endTime);
      setCarrier(booking.carrier);
      setTruckRego(booking.truckRego || '');
      setDockNumber(booking.dockNumber?.toString() || '');
      setNotes(booking.notes || '');
      setStatus(booking.status);
      setSelectedPO(booking.purchaseOrder || null);
    } else {
      // Reset form for new booking
      setTitle('');
      setDate(defaultDate ? format(defaultDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
      setStartTime(defaultHour ? `${defaultHour.toString().padStart(2, '0')}:00` : '09:00');
      setEndTime(defaultHour ? `${(defaultHour + 1).toString().padStart(2, '0')}:00` : '10:00');
      setCarrier('');
      setTruckRego('');
      setDockNumber('');
      setNotes('');
      setStatus('scheduled');
      setSelectedPO(null);
    }
  }, [booking, defaultDate, defaultHour, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSave({
      id: booking?.id,
      title: title || (selectedPO ? `${selectedPO.customer} Delivery` : 'New Booking'),
      date: new Date(date),
      startTime,
      endTime,
      carrier,
      truckRego: truckRego || undefined,
      dockNumber: dockNumber ? parseInt(dockNumber) : undefined,
      purchaseOrderId: selectedPO?.id,
      purchaseOrder: selectedPO || undefined,
      notes: notes || undefined,
      status,
    });
    
    onClose();
  };

  const handleDelete = () => {
    if (booking && onDelete) {
      onDelete(booking.id);
      onClose();
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
            <Label>CartonCloud Purchase Order</Label>
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
                <Command>
                  <CommandInput placeholder="Search by PO reference or customer..." />
                  <CommandList>
                    <CommandEmpty>No purchase orders found.</CommandEmpty>
                    <CommandGroup>
                      {mockPurchaseOrders.map((po) => (
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
                              <Badge variant={po.status === 'in_transit' ? 'default' : 'secondary'} className="text-xs">
                                {po.status}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {po.customer} • {po.items} items
                            </div>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedPO && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPO(null)}
                className="text-muted-foreground"
              >
                <X className="w-3 h-3 mr-1" /> Remove PO
              </Button>
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
              <Label htmlFor="carrier">Carrier</Label>
              <Input
                id="carrier"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g., Express Freight"
              />
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
              <Label>Dock Number</Label>
              <Select value={dockNumber} onValueChange={setDockNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select dock" />
                </SelectTrigger>
                <SelectContent>
                  {DOCK_NUMBERS.map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      Dock {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CrossDockBooking['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

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
