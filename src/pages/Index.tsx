import { useState, useEffect } from 'react';
import { CalendarView, CrossDockBooking } from '@/types/booking';
import { mockBookings } from '@/data/mockData';
import { Header } from '@/components/Header';
import { CalendarHeader } from '@/components/CalendarHeader';
import { DayView } from '@/components/DayView';
import { WeekView } from '@/components/WeekView';
import { BookingModal } from '@/components/BookingModal';
import { Sidebar } from '@/components/Sidebar';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useDockDoors } from '@/hooks/useDockDoors';
import { useAuth } from '@/hooks/useAuth';

const STORAGE_KEY_VIEW = 'crossdock-calendar-view';

const Index = () => {
  const { user } = useAuth();
  const { data: dockDoors } = useDockDoors();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>(() => {
    const savedView = localStorage.getItem(STORAGE_KEY_VIEW);
    return (savedView === 'week' || savedView === 'day') ? savedView : 'day';
  });
  const [bookings, setBookings] = useState<CrossDockBooking[]>(mockBookings);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<CrossDockBooking | null>(null);
  const [defaultSlot, setDefaultSlot] = useState<{ date: Date; hour: number; dockNumber?: number } | null>(null);

  // Persist view preference
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VIEW, view);
  }, [view]);

  const handleAddBooking = () => {
    setSelectedBooking(null);
    setDefaultSlot(null);
    setModalOpen(true);
  };

  const handleTimeSlotClick = (date: Date, hour: number, dockId?: string) => {
    setSelectedBooking(null);
    
    // Find dock number from dock ID
    let dockNumber: number | undefined;
    if (dockId && dockDoors) {
      const dock = dockDoors.find(d => d.id === dockId);
      if (dock) {
        dockNumber = parseInt(dock.name.replace(/\D/g, ''), 10) || undefined;
      }
    }
    
    setDefaultSlot({ date, hour, dockNumber });
    setModalOpen(true);
  };

  const handleBookingClick = (booking: CrossDockBooking) => {
    setSelectedBooking(booking);
    setDefaultSlot(null);
    setModalOpen(true);
  };

  const handleSaveBooking = (bookingData: Partial<CrossDockBooking>) => {
    if (bookingData.id) {
      // Edit existing booking
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingData.id ? { ...b, ...bookingData } as CrossDockBooking : b
        )
      );
      toast({
        title: 'Booking Updated',
        description: `${bookingData.title} has been updated successfully.`,
      });
    } else {
      // Create new booking
      const newBooking: CrossDockBooking = {
        id: Date.now().toString(),
        title: bookingData.title || 'New Booking',
        date: bookingData.date || new Date(),
        startTime: bookingData.startTime || '09:00',
        endTime: bookingData.endTime || '10:00',
        carrier: bookingData.carrier || '',
        truckRego: bookingData.truckRego,
        dockNumber: bookingData.dockNumber,
        purchaseOrderId: bookingData.purchaseOrderId,
        purchaseOrder: bookingData.purchaseOrder,
        notes: bookingData.notes,
        status: bookingData.status || 'scheduled',
        createdBy: user?.id || 'unknown',
        createdAt: new Date(),
      };
      setBookings((prev) => [...prev, newBooking]);
      toast({
        title: 'Booking Created',
        description: `${newBooking.title} has been scheduled.`,
      });
    }
  };

  const handleDeleteBooking = (id: string) => {
    setBookings((prev) => prev.filter((b) => b.id !== id));
    toast({
      title: 'Booking Deleted',
      description: 'The booking has been removed.',
      variant: 'destructive',
    });
  };

  const handleBookingMove = (booking: CrossDockBooking, newDate: Date, dropHour: number, offsetMinutes: number, newDockId?: string) => {
    // Calculate the duration of the booking in minutes
    const [startH, startM] = booking.startTime.split(':').map(Number);
    const [endH, endM] = booking.endTime.split(':').map(Number);
    const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    
    // Calculate the new start time by subtracting the click offset from the drop position
    // dropHour is where the mouse was released, offsetMinutes is how far into the booking they clicked
    const dropMinutes = dropHour * 60;
    const newStartMinutes = Math.max(0, dropMinutes - offsetMinutes);
    
    // Snap to 15-minute intervals
    const snappedStartMinutes = Math.round(newStartMinutes / 15) * 15;
    
    // Calculate end time
    const newEndMinutes = Math.min(23 * 60 + 59, snappedStartMinutes + durationMinutes);
    
    const newStartHour = Math.floor(snappedStartMinutes / 60);
    const newStartMin = snappedStartMinutes % 60;
    const newEndHour = Math.floor(newEndMinutes / 60);
    const newEndMin = newEndMinutes % 60;
    
    const newStartTime = `${newStartHour.toString().padStart(2, '0')}:${newStartMin.toString().padStart(2, '0')}`;
    const newEndTime = `${newEndHour.toString().padStart(2, '0')}:${newEndMin.toString().padStart(2, '0')}`;
    
    // Get new dock number from dock ID
    let newDockNumber: number | undefined = booking.dockNumber;
    if (newDockId && dockDoors) {
      const dock = dockDoors.find(d => d.id === newDockId);
      if (dock) {
        newDockNumber = parseInt(dock.name.replace(/\D/g, ''), 10) || undefined;
      }
    }
    
    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id
          ? { ...b, date: newDate, startTime: newStartTime, endTime: newEndTime, dockNumber: newDockNumber }
          : b
      )
    );
    
    const dockInfo = newDockNumber ? ` on Dock ${newDockNumber}` : '';
    toast({
      title: 'Booking Moved',
      description: `${booking.title} moved to ${format(newDate, 'EEE, MMM d')} at ${newStartTime}${dockInfo}`,
    });
  };

  const handleBookingResize = (booking: CrossDockBooking, newEndTime: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id ? { ...b, endTime: newEndTime } : b
      )
    );
    
    toast({
      title: 'Booking Duration Changed',
      description: `${booking.title} now ends at ${newEndTime}`,
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex-1 flex flex-col">
        <CalendarHeader
          currentDate={currentDate}
          view={view}
          onDateChange={setCurrentDate}
          onViewChange={setView}
          onAddBooking={handleAddBooking}
        />
        
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col bg-card">
            {view === 'day' ? (
              <DayView
                date={currentDate}
                bookings={bookings}
                onTimeSlotClick={handleTimeSlotClick}
                onBookingClick={handleBookingClick}
                onBookingMove={handleBookingMove}
                onBookingResize={handleBookingResize}
              />
            ) : (
              <WeekView
                date={currentDate}
                bookings={bookings}
                onTimeSlotClick={handleTimeSlotClick}
                onBookingClick={handleBookingClick}
                onBookingMove={handleBookingMove}
                onBookingResize={handleBookingResize}
              />
            )}
          </div>
          
          <Sidebar bookings={bookings} onBookingClick={handleBookingClick} />
        </div>
      </div>

      <BookingModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveBooking}
        onDelete={handleDeleteBooking}
        booking={selectedBooking}
        defaultDate={defaultSlot?.date}
        defaultHour={defaultSlot?.hour}
        defaultDockNumber={defaultSlot?.dockNumber}
      />
    </div>
  );
};

export default Index;
