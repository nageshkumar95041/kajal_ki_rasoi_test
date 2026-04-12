"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiteSettings = exports.Agent = exports.TiffinItem = exports.MenuItem = exports.TempSubscription = exports.TempCart = exports.Subscription = exports.Order = exports.User = void 0;
const mongoose_1 = require("mongoose");
// ─── User ─────────────────────────────────────────────────────────────────────
const userSchema = new mongoose_1.Schema({
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
exports.User = mongoose_1.models.User || (0, mongoose_1.model)('User', userSchema);
// ─── Order ────────────────────────────────────────────────────────────────────
const orderSchema = new mongoose_1.Schema({
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
    agentId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Agent' },
    deliveryOtp: { type: String },
    podImageUrl: { type: String },
    failedDeliveryReason: { type: String },
}, { toJSON: { virtuals: true } });
exports.Order = mongoose_1.models.Order || (0, mongoose_1.model)('Order', orderSchema);
// ─── Subscription ─────────────────────────────────────────────────────────────
const subscriptionSchema = new mongoose_1.Schema({
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
exports.Subscription = mongoose_1.models.Subscription || (0, mongoose_1.model)('Subscription', subscriptionSchema);
// ─── TempCart ─────────────────────────────────────────────────────────────────
const cartSchema = new mongoose_1.Schema({
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
exports.TempCart = mongoose_1.models.TempCart || (0, mongoose_1.model)('TempCart', cartSchema);
// ─── TempSubscription ─────────────────────────────────────────────────────────
const tempSubscriptionSchema = new mongoose_1.Schema({
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
exports.TempSubscription = mongoose_1.models.TempSubscription || (0, mongoose_1.model)('TempSubscription', tempSubscriptionSchema);
// ─── MenuItem ─────────────────────────────────────────────────────────────────
const menuItemSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    description: { type: String },
    category: { type: String, default: '🍲 Main Course', index: true },
    imageUrl: { type: String },
    available: { type: Boolean, default: true },
});
exports.MenuItem = mongoose_1.models.MenuItem || (0, mongoose_1.model)('MenuItem', menuItemSchema);
// ─── TiffinItem ───────────────────────────────────────────────────────────────
const tiffinItemSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true },
    meta: { type: String, default: 'Lunch · Veg' },
    emoji: { type: String, default: '🍛' },
    available: { type: Boolean, default: true },
});
exports.TiffinItem = mongoose_1.models.TiffinItem || (0, mongoose_1.model)('TiffinItem', tiffinItemSchema);
// ─── Agent ────────────────────────────────────────────────────────────────────
const agentSchema = new mongoose_1.Schema({
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
exports.Agent = mongoose_1.models.Agent || (0, mongoose_1.model)('Agent', agentSchema);
// ─── SiteSettings ─────────────────────────────────────────────────────────────
const siteSettingsSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose_1.Schema.Types.Mixed },
}, { timestamps: true, strict: false });
exports.SiteSettings = mongoose_1.models.SiteSettings || (0, mongoose_1.model)('SiteSettings', siteSettingsSchema);
