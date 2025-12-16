import { useState } from 'react';
import { CalendarView, CrossDockBooking } from '@/types/booking';
import { mockUser, mockBookings } from '@/data/mockData';
import { Header } from '@/components/Header';
import { CalendarHeader } from '@/components/CalendarHeader';
import { DayView } from '@/components/DayView';
import { WeekView } from '@/components/WeekView';
import { BookingModal } from '@/components/BookingModal';
import { Sidebar } from '@/components/Sidebar';
import { toast } from '@/hooks/use-toast';

const Index = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('day');
  const [bookings, setBookings] = useState<CrossDockBooking[]>(mockBookings);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<CrossDockBooking | null>(null);
  const [defaultSlot, setDefaultSlot] = useState<{ date: Date; hour: number } | null>(null);

  const handleAddBooking = () => {
    setSelectedBooking(null);
    setDefaultSlot(null);
    setModalOpen(true);
  };

  const handleTimeSlotClick = (date: Date, hour: number) => {
    setSelectedBooking(null);
    setDefaultSlot({ date, hour });
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
        createdBy: mockUser.id,
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header user={mockUser} />
      
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
              />
            ) : (
              <WeekView
                date={currentDate}
                bookings={bookings}
                onTimeSlotClick={handleTimeSlotClick}
                onBookingClick={handleBookingClick}
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
      />
    </div>
  );
};

export default Index;
