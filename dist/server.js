"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server.ts — Custom Next.js server that adds Socket.IO
// Run with: ts-node server.ts
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv = __importStar(require("dotenv"));
// dotenv.config({ path: '.env.local' });
if (process.env.NODE_ENV !== 'production') {
    dotenv.config({ path: '.env.local' });
}
const dev = process.env.NODE_ENV !== 'production';
const app = (0, next_1.default)({ dev });
const handle = app.getRequestHandler();
const PORT = parseInt(process.env.PORT || '3000', 10);
app.prepare().then(async () => {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
        console.error('FATAL: MONGODB_URI not set');
        process.exit(1);
    }
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    // Seed data on first run
    const { seedAdmin, seedMenu, seedTiffin } = await Promise.resolve().then(() => __importStar(require('./src/lib/seed')));
    await seedAdmin();
    await seedMenu();
    await seedTiffin();
    const server = (0, http_1.createServer)((req, res) => {
        const parsedUrl = (0, url_1.parse)(req.url, true);
        handle(req, res, parsedUrl);
    });
    // Attach Socket.IO
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || '*',
            methods: ['GET', 'POST'],
        },
    });
    // Store io globally so API routes can emit
    global._io = io;
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        socket.on('join_order_room', (orderId) => {
            socket.join(`order_${orderId}`);
        });
        socket.on('agent_online', (agentId) => {
            socket.join(`agent_${agentId}`);
        });
        socket.on('agent_location_update', (data) => {
            if (data.orderId) {
                io.to(`order_${data.orderId}`).emit('live_location', { lat: data.lat, lng: data.lng });
            }
        });
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
    server.listen(PORT, () => {
        console.log(`🚀 Apna Rasoi running at http://localhost:${PORT}`);
    });
});
