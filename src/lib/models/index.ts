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
  customerName: { type: String, required: true },
  contact: { type: String },
  phone: { type: String },
  address: { type: String, required: true },
  items: { type: Array, required: true },
  total: { type: Number, required: true },
  paymentMethod: { type: String, default: 'Online', enum: ['Online', 'COD'] },
  status: {
    type: String, default: 'Pending',
    enum: ['Pending', 'Preparing', 'Out for Delivery', 'Completed', 'Rejected', 'Cancelled', 'Failed'],
    index: true,
  },
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
  customerName: { type: String, required: true },
  contact: { type: String },
  phone: { type: String },
  address: { type: String, required: true },
  cart: { type: Object, required: true },
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
  name: { type: String, required: true, unique: true },
  price: { type: Number, required: true },
  description: { type: String },
  category: { type: String, default: '🍲 Main Course', index: true },
  imageUrl: { type: String },
  available: { type: Boolean, default: true },
});

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
  maxBatchLimit: { type: Number, default: 1000 },
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