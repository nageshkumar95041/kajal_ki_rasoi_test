const BORZO_API_KEY = process.env.BORZO_API_KEY;
const BORZO_ENV = process.env.BORZO_ENV || 'sandbox';
export const RESTAURANT_LAT = parseFloat(process.env.RESTAURANT_LAT || '0');
export const RESTAURANT_LNG = parseFloat(process.env.RESTAURANT_LNG || '0');
export const RESTAURANT_ADDRESS = process.env.RESTAURANT_ADDRESS || '';
export const RESTAURANT_PHONE = process.env.RESTAURANT_PHONE || '';
export const RESTAURANT_NAME = process.env.RESTAURANT_NAME || 'Kajal Ki Rasoi';

export const BORZO_API_BASE_URL =
  BORZO_ENV === 'production'
    ? 'https://api.borzodelivery.com/api/business/1.6'
    : 'https://robotapitest-in.borzodelivery.com/api/business/1.6';

export interface OrderForDelivery {
  _id: unknown;
  customerName: string;
  contact?: string;
  address: string;
  customerLat?: number;
  customerLng?: number;
  total: number;
  paymentMethod: string;
  borzoOrderId?: string;
  borzoTrackingUrl?: string;
  borzoStatus?: string;
  save: () => Promise<void>;
}

export async function createBorzoDelivery(order: OrderForDelivery) {
  if (!BORZO_API_KEY) {
    console.log(`Borzo API key not set. Skipping delivery for order ${order._id}.`);
    return;
  }
  if (!order.customerLat || !order.customerLng) {
    console.error(`Missing coordinates for order ${order._id}`);
    return;
  }

  const payload = {
    matter: `Homemade food - ${RESTAURANT_NAME}`,
    vehicle_type_id: 8,
    points: [
      {
        address: RESTAURANT_ADDRESS,
        latitude: RESTAURANT_LAT,
        longitude: RESTAURANT_LNG,
        contact_person: { name: RESTAURANT_NAME, phone: RESTAURANT_PHONE },
        note: `Order #${String(order._id).slice(-5)}`,
      },
      {
        address: order.address,
        latitude: order.customerLat,
        longitude: order.customerLng,
        contact_person: { name: order.customerName, phone: order.contact },
        note: `Payment: ${order.paymentMethod}. Total: ₹${order.total}.`,
      },
    ],
  };

  try {
    const response = await fetch(`${BORZO_API_BASE_URL}/create-order`, {
      method: 'POST',
      headers: { 'X-DV-Auth-Token': BORZO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (response.ok && data.is_successful) {
      order.borzoOrderId = data.order.order_id;
      order.borzoTrackingUrl = data.order.tracking_url;
      order.borzoStatus = data.order.status_name;
      await order.save();
    } else {
      console.error(`Borzo error for order ${order._id}:`, data.message);
    }
  } catch (err) {
    console.error(`Borzo connection failed for order ${order._id}:`, err);
  }
}
