import { CrossDockBooking, PurchaseOrder, User } from '@/types/booking';
import { addDays, setHours, setMinutes } from 'date-fns';

const today = new Date();

export const mockUser: User = {
  id: '1',
  name: 'Scott Murray',
  email: 'scott@cartoncloud.com',
  role: 'admin',
};

export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    id: 'PO-1234343',
    reference: '1234343',
    customer: 'CARTONCLOUD 3PL',
    items: 24,
    status: 'pending',
    expectedDate: today,
  },
  {
    id: 'PO-1234567',
    reference: '1234567',
    customer: 'Fresh Foods Ltd',
    items: 48,
    status: 'in_transit',
    expectedDate: addDays(today, 1),
  },
  {
    id: 'PO-1234890',
    reference: '1234890',
    customer: 'Warehouse Direct',
    items: 12,
    status: 'pending',
    expectedDate: addDays(today, 2),
  },
  {
    id: 'PO-1235001',
    reference: '1235001',
    customer: 'Metro Logistics',
    items: 36,
    status: 'pending',
    expectedDate: today,
  },
  {
    id: 'PO-1235102',
    reference: '1235102',
    customer: 'Quick Ship Co',
    items: 18,
    status: 'in_transit',
    expectedDate: addDays(today, 1),
  },
];

export const mockBookings: CrossDockBooking[] = [
  {
    id: '1',
    title: 'CARTONCLOUD 3PL Delivery',
    date: setMinutes(setHours(today, 9), 0),
    startTime: '09:00',
    endTime: '10:30',
    carrier: 'Express Freight',
    truckRego: 'ABC-123',
    dockNumber: 1,
    purchaseOrderId: 'PO-1234343',
    purchaseOrder: mockPurchaseOrders[0],
    notes: 'Priority delivery - handle with care',
    status: 'scheduled',
    createdBy: '1',
    createdAt: addDays(today, -1),
  },
  {
    id: '2',
    title: 'Fresh Foods Pickup',
    date: setMinutes(setHours(today, 14), 0),
    startTime: '14:00',
    endTime: '15:00',
    carrier: 'Cold Chain Transport',
    truckRego: 'XYZ-789',
    dockNumber: 2,
    purchaseOrderId: 'PO-1234567',
    purchaseOrder: mockPurchaseOrders[1],
    status: 'scheduled',
    createdBy: '1',
    createdAt: addDays(today, -2),
  },
  {
    id: '3',
    title: 'Warehouse Direct Transfer',
    date: setMinutes(setHours(addDays(today, 1), 10), 0),
    startTime: '10:00',
    endTime: '11:30',
    carrier: 'Local Haulers',
    dockNumber: 3,
    purchaseOrderId: 'PO-1234890',
    purchaseOrder: mockPurchaseOrders[2],
    notes: 'Large pallets - need forklift ready',
    status: 'scheduled',
    createdBy: '1',
    createdAt: addDays(today, -1),
  },
  {
    id: '4',
    title: 'Metro Logistics Inbound',
    date: setMinutes(setHours(today, 11), 0),
    startTime: '11:00',
    endTime: '12:00',
    carrier: 'Metro Fleet',
    truckRego: 'MET-456',
    dockNumber: 1,
    purchaseOrderId: 'PO-1235001',
    purchaseOrder: mockPurchaseOrders[3],
    status: 'arrived',
    createdBy: '1',
    createdAt: addDays(today, -3),
  },
];

export const DOCK_NUMBERS = [1, 2, 3, 4, 5];

export const HOURS = Array.from({ length: 14 }, (_, i) => ({
  hour: i + 6, // 6 AM to 7 PM
  label: `${(i + 6).toString().padStart(2, '0')}:00`,
}));
