"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedAdmin = seedAdmin;
exports.seedMenu = seedMenu;
exports.seedTiffin = seedTiffin;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const models_1 = require("./models");
async function seedAdmin() {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    const hashedPassword = await bcryptjs_1.default.hash(adminPassword, 10);
    await models_1.User.findOneAndUpdate({ role: 'admin' }, { name: 'Restaurant Admin', contact: adminUsername.toLowerCase(), password: hashedPassword }, { upsert: true, new: true });
    console.log(`✅ Admin user verified: ${adminUsername}`);
}
async function seedMenu() {
    const count = await models_1.MenuItem.countDocuments();
    if (count >= 10)
        return;
    await models_1.MenuItem.deleteMany({});
    await models_1.MenuItem.insertMany([
        { name: 'Special Thali', price: 180, available: true, description: '4 Roti, Rice, Seasonal Sabzi, Dal Tadka, and fresh Salad.', category: "🌟 Today's Special" },
        { name: 'Gajar Ka Halwa', price: 100, available: true, description: 'Traditional winter dessert made with grated carrots, milk, and nuts.', category: "🌟 Today's Special" },
        { name: 'Poori Sabji', price: 100, available: true, description: '4 fluffy pooris served with spicy potato curry.', category: "🌟 Today's Special" },
        { name: 'Budget Meal (₹99)', price: 99, available: true, description: '3 Roti, Dal, Dry Sabzi, and Pickle.', category: '💰 Budget Meals' },
        { name: 'Budget Meal (₹149)', price: 149, available: true, description: '3 Roti, Rice, Dal Makhani, Mix Veg, and Curd.', category: '💰 Budget Meals' },
        { name: 'Dal + Rice Combo', price: 149, available: true, description: 'Comforting yellow Dal Tadka served with Jeera Rice and salad.', category: '🍱 Value Combos' },
        { name: 'Paneer + 2 Naan Combo', price: 199, available: true, description: 'Rich Paneer Butter Masala served with 2 Butter Naan.', category: '🍱 Value Combos' },
        { name: 'Dal Tadka', price: 120, available: true, description: 'Yellow lentils cooked with onions, tomatoes and garlic.', category: '🍲 Main Course' },
        { name: 'Dal Makhani', price: 160, available: true, description: 'Slow-cooked black lentils in a rich, creamy sauce.', category: '🍲 Main Course' },
        { name: 'Shahi Paneer', price: 220, available: true, description: 'Soft paneer cubes in a thick, creamy nut-based gravy.', category: '🍲 Main Course' },
        { name: 'Kadai Paneer', price: 200, available: true, description: 'Paneer tossed with bell peppers and onions in a spicy masala.', category: '🍲 Main Course' },
        { name: 'Paneer Butter Masala', price: 210, available: true, description: 'Paneer cooked in a rich and creamy tomato and butter gravy.', category: '🍲 Main Course' },
        { name: 'Palak Paneer', price: 190, available: true, description: 'Nutritious spinach gravy with soft paneer cubes.', category: '🍲 Main Course' },
        { name: 'Mix Veg', price: 140, available: true, description: 'Assorted seasonal vegetables cooked with aromatic spices.', category: '🍲 Main Course' },
        { name: 'Veg Biryani', price: 180, available: true, description: 'Aromatic layered rice and vegetable dish cooked with spices.', category: '🍲 Main Course' },
        { name: 'Butter Naan', price: 45, available: true, description: 'Soft naan brushed with generous butter.', category: '🍲 Main Course' },
        { name: 'Aloo Paratha', price: 50, available: true, description: 'Whole wheat flatbread stuffed with spiced potatoes.', category: '🍲 Main Course' },
        { name: 'Plain Rice', price: 80, available: true, description: 'Steamed basmati rice.', category: '🍲 Main Course' },
        { name: 'Jeera Rice', price: 100, available: true, description: 'Basmati rice tempered with cumin seeds.', category: '🍲 Main Course' },
    ]);
    console.log('✅ Menu seeded');
}
async function seedTiffin() {
    const count = await models_1.TiffinItem.countDocuments();
    if (count > 0)
        return;
    await models_1.TiffinItem.insertMany([
        { name: 'Dal Makhani + Rice', price: 120, available: true, meta: 'Lunch · Veg', emoji: '🍛' },
        { name: 'Aloo Paratha + Curd', price: 80, available: true, meta: 'Breakfast · Veg', emoji: '🫓' },
        { name: 'Paneer Sabzi + Roti', price: 130, available: true, meta: 'Dinner · Veg', emoji: '🍲' },
    ]);
    console.log('✅ Tiffin items seeded');
}
