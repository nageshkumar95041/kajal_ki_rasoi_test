import mongoose, { Schema, model, models, type Model } from 'mongoose';

// ─── User ─────────────────────────────────────────────────────────────────────
const userSchema = new Schema({
  name: { type: String, required: true },
  contact: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  isTrusted: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  verificationOtp: { type: String },
  otpExpires: { type: Date },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
}, { toJSON: { virtuals: true } });

export const User: Model<any> = models.User || model('User', userSchema);

// ─── Order ────────────────────────────────────────────────────────────────────
const orderSchema = new Schema({
  userId: { type: String, index: true },
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', index: true },
  customerName: { type: String, required: true },
  contact: { type: String },
  phone: { type: String },
  address: { type: String, required: true },
  items: { type: Array, required: true },
  total: { type: Number, required: true },
  newCustomerOfferApplied: { type: Boolean, default: false },
  newCustomerOfferDiscount: { type: Number, default: 0 },
  newCustomerOfferItemName: { type: String },
  paymentMethod: { type: String, default: 'Online', enum: ['Online', 'COD'] },
  status: {
    type: String, default: 'Pending',
    enum: ['Pending', 'Preparing', 'Out for Delivery', 'Completed', 'Rejected', 'Cancelled', 'Failed'],
    index: true,
  },
  cancellationReason: { type: String },
  cancelledAt: { type: Date },
  cancelledBy: { type: String, enum: ['customer', 'restaurant', 'admin'] },
  timestamp: { type: Date, default: Date.now, index: true },
  rating: { type: Number },
  review: { type: String },
  deliveryFee: { type: Number, default: 0 },
  customerLat: { type: Number },
  customerLng: { type: Number },
  borzoOrderId: { type: String },
  borzoTrackingUrl: { type: String },
  borzoStatus: { type: String },
  borzoCourier: { name: String, phone: String },
  inHouseDelivery: { type: Boolean, default: false },
  agentId: { type: Schema.Types.ObjectId, ref: 'Agent' },
  deliveryOtp: { type: String },
  podImageUrl: { type: String },
  failedDeliveryReason: { type: String },
}, { toJSON: { virtuals: true } });

export const Order: Model<any> = models.Order || model('Order', orderSchema);

// ─── Subscription ─────────────────────────────────────────────────────────────
const subscriptionSchema = new Schema({
  userId: { type: String, index: true },
  customerName: { type: String, required: true },
  contact: { type: String, required: true },
  address: { type: String, required: true },
  plan: { type: String, required: true },
  frequency: { type: Number, required: true },
  persons: { type: Number, default: 1 },
  couponCode: { type: String },
  price: { type: Number, required: true },
  startDate: { type: Date, required: true },
  status: { type: String, default: 'Pending', index: true },
  timestamp: { type: Date, default: Date.now },
});

export const Subscription: Model<any> = models.Subscription || model('Subscription', subscriptionSchema);

// ─── TempCart ─────────────────────────────────────────────────────────────────
const cartSchema = new Schema({
  stripeSessionId: { type: String, required: true, index: true },
  userId: { type: String },
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant' },
  customerName: { type: String, required: true },
  contact: { type: String },
  phone: { type: String },
  address: { type: String, required: true },
  cart: { type: Object, required: true },
  newCustomerOfferApplied: { type: Boolean, default: false },
  newCustomerOfferDiscount: { type: Number, default: 0 },
  newCustomerOfferItemName: { type: String },
  deliveryFee: { type: Number, default: 0 },
  customerLat: { type: Number },
  customerLng: { type: Number },
});

export const TempCart: Model<any> = models.TempCart || model('TempCart', cartSchema);

// ─── TempSubscription ─────────────────────────────────────────────────────────
const tempSubscriptionSchema = new Schema({
  stripeSessionId: { type: String, required: true, index: true },
  userId: { type: String },
  customerName: { type: String, required: true },
  contact: { type: String, required: true },
  address: { type: String, required: true },
  plan: { type: String, required: true },
  frequency: { type: Number, required: true },
  persons: { type: Number, default: 1 },
  couponCode: { type: String },
  price: { type: Number, required: true },
  startDate: { type: Date, required: true },
});

export const TempSubscription: Model<any> = models.TempSubscription || model('TempSubscription', tempSubscriptionSchema);

// ─── MenuItem ─────────────────────────────────────────────────────────────────
const menuItemSchema = new Schema({
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant', index: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  category: { type: String, default: '🍲 Main Course', index: true },
  imageUrl: { type: String },
  available: { type: Boolean, default: true },
});

menuItemSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
export const MenuItem: Model<any> = models.MenuItem || model('MenuItem', menuItemSchema);

// ─── TiffinItem ───────────────────────────────────────────────────────────────
const tiffinItemSchema = new Schema({
  name: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  meta: { type: String, default: 'Lunch · Veg' },
  emoji: { type: String, default: '🍛' },
  available: { type: Boolean, default: true },
});

export const TiffinItem: Model<any> = models.TiffinItem || model('TiffinItem', tiffinItemSchema);

// ─── Agent ────────────────────────────────────────────────────────────────────
const agentSchema = new Schema({
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String },
  status: { type: String, default: 'Offline', enum: ['Available', 'Busy', 'Offline'] },
  currentLoad: { type: Number, default: 0 },
  maxBatchLimit: { type: Number, default: 5 },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
});

agentSchema.index({ location: '2dsphere' });
export const Agent: Model<any> = models.Agent || model('Agent', agentSchema);

// ─── SiteSettings ─────────────────────────────────────────────────────────────
const siteSettingsSchema = new Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed },
}, { timestamps: true, strict: false });

export const SiteSettings: Model<any> = models.SiteSettings || model('SiteSettings', siteSettingsSchema);

// ─── Restaurant ───────────────────────────────────────────────────────────────
const restaurantSchema = new Schema({
  name: { type: String, required: true },
  ownerId: { type: String, required: true, unique: true },
  contact: { type: String, required: true },
  address: { type: String, required: true },
  description: { type: String },
  imageUrl: { type: String },
  isActive: { type: Boolean, default: true },
  isOpen: { type: Boolean, default: true },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
  operatingHours: {
    monday: { open: { type: String, default: '09:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
    tuesday: { open: { type: String, default: '09:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
    wednesday: { open: { type: String, default: '09:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
    thursday: { open: { type: String, default: '09:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
    friday: { open: { type: String, default: '09:00' }, close: { type: String, default: '22:00' }, closed: { type: Boolean, default: false } },
    saturday: { open: { type: String, default: '09:00' }, close: { type: String, default: '23:00' }, closed: { type: Boolean, default: false } },
    sunday: { open: { type: String, default: '10:00' }, close: { type: String, default: '23:00' }, closed: { type: Boolean, default: false } },
  },
  estimatedDeliveryTime: { type: Number, default: 30 }, // in minutes
}, { timestamps: true });

restaurantSchema.index({ location: '2dsphere' });
export const Restaurant: Model<any> = models.Restaurant || model('Restaurant', restaurantSchema);

// ─── Notification ──────────────────────────────────────────────────────────────
const notificationSchema = new Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['order_placed', 'order_status', 'order_completed', 'new_order', 'payment_received'], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
  restaurantId: { type: Schema.Types.ObjectId, ref: 'Restaurant' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const Notification: Model<any> = models.Notification || model('Notification', notificationSchema);
