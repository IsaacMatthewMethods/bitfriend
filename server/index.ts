import express from 'express';
import http from 'node:http';
import cors from 'cors';
import { initializeDatabase } from './db/database.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { SocketServer } from './ws/socketServer.js';

import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import txRoutes from './routes/txRoutes.js';
import fiatRoutes from './routes/fiatRoutes.js';
import adashiRoutes from './routes/adashiRoutes.js';
import posRoutes from './routes/posRoutes.js';
import marketRoutes from './routes/marketRoutes.js';

// 1. Initialize SQLite Database & Tables
initializeDatabase();

const app = express();
const server = http.createServer(app);

// 2. Core Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-pubkey']
}));
app.use(express.json({ limit: '2mb' }));
app.use(rateLimiter);

// 3. API Route Directory Index
app.get('/api', (_req, res) => {
  res.json({
    name: 'BitFriend Production Enterprise REST API',
    version: '2.4.0',
    documentation: 'African Grassroots Bitcoin & Ecash Commerce Protocol',
    endpoints: {
      health: '/api/v1/health',
      auth: {
        challenge: 'POST /api/v1/auth/challenge',
        verify: 'POST /api/v1/auth/verify',
        pin: 'POST /api/v1/auth/pin',
        profile: 'GET /api/v1/auth/me'
      },
      wallet: {
        balance: 'GET /api/v1/wallet/balance',
        syncProofs: 'POST /api/v1/wallet/proofs/sync',
        checkProofs: 'POST /api/v1/wallet/proofs/check'
      },
      transactions: {
        list: 'GET /api/v1/transactions',
        record: 'POST /api/v1/transactions',
        detail: 'GET /api/v1/transactions/:id'
      },
      fiatGateway: {
        rates: 'GET /api/v1/fiat/rates',
        banks: 'GET /api/v1/fiat/banks',
        resolveNuban: 'POST /api/v1/fiat/resolve-nuban',
        quote: 'POST /api/v1/fiat/quote',
        settle: 'POST /api/v1/fiat/settle'
      },
      adashiCircles: {
        list: 'GET /api/v1/adashi/circles',
        detail: 'GET /api/v1/adashi/circles/:id',
        create: 'POST /api/v1/adashi/circles',
        join: 'POST /api/v1/adashi/circles/:id/join',
        contribute: 'POST /api/v1/adashi/circles/:id/contribute',
        payout: 'POST /api/v1/adashi/circles/:id/payout'
      },
      posMerchant: {
        catalog: 'GET /api/v1/pos/catalog',
        addItem: 'POST /api/v1/pos/catalog',
        createOrder: 'POST /api/v1/pos/order',
        settleOrder: 'POST /api/v1/pos/order/:id/settle'
      },
      market: {
        ticker: 'GET /api/v1/market/ticker',
        orderbook: 'GET /api/v1/market/orderbook'
      },
      websocket: 'ws://localhost:4000/ws'
    }
  });
});

// 4. Mount API Routes
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/transactions', txRoutes);
app.use('/api/v1/fiat', fiatRoutes);
app.use('/api/v1/adashi', adashiRoutes);
app.use('/api/v1/pos', posRoutes);
app.use('/api/v1/market', marketRoutes);

// 5. Global Error Handler
app.use(errorHandler);

// 6. Mount WebSocket Server
SocketServer.init(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`======================================================`);
  console.log(`⚡ BitFriend Backend Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket Server active on ws://localhost:${PORT}/ws`);
  console.log(`📚 API Directory available at http://localhost:${PORT}/api`);
  console.log(`======================================================`);
});

export default app;
