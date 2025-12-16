export type UserRole = 'admin' | 'dock_operator' | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface PurchaseOrder {
  id: string;
  reference: string;
  customer: string;
  items: number;
  status: 'pending' | 'in_transit' | 'delivered';
  expectedDate: Date;
}

export interface CrossDockBooking {
  id: string;
  title: string;
  date: Date;
  startTime: string; // HH:MM format
  endTime: string;
  carrier: string;
  truckRego?: string;
  dockNumber?: number;
  purchaseOrderId?: string;
  purchaseOrder?: PurchaseOrder;
  notes?: string;
  status: 'scheduled' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: Date;
}

export type CalendarView = 'day' | 'week';

export interface TimeSlot {
  hour: number;
  label: string;
}
