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
  status: 'pending' | 'in_transit' | 'delivered' | string;
  expectedDate: Date | null;
}

export interface CartonCloudPO {
  id: string;
  reference: string;
  customer: string;
  status: string;
  arrivalDate: string | null;
  itemCount: number;
  warehouseName: string;
}

// Custom field values stored as key-value pairs
export type CustomFieldValues = Record<string, string | string[] | Date | null>;

export interface CrossDockBooking {
  id: string;
  title: string;
  date: Date;
  startTime: string; // HH:MM format
  endTime: string;
  carrier: string;
  truckRego?: string;
  dockNumber?: number;
  dockDoorId?: string;
  purchaseOrderId?: string;
  purchaseOrder?: PurchaseOrder;
  cartonCloudPO?: CartonCloudPO;
  notes?: string;
  status: 'scheduled' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: Date;
  customFields?: CustomFieldValues;
}

export type CalendarView = 'day' | 'week';

export interface TimeSlot {
  hour: number;
  label: string;
}
