import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { MarketService } from '../services/marketService.js';

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'broadcast' | 'ping';
  channel?: string;
  payload?: any;
}

export class SocketServer {
  private static wss: WebSocketServer;
  private static clientSubscriptions = new Map<WebSocket, Set<string>>();

  static init(server: Server): WebSocketServer {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    console.log('[BitFriend WS] WebSocket server mounted on /ws');

    this.wss.on('connection', (ws: WebSocket) => {
      this.clientSubscriptions.set(ws, new Set(['market:ticker']));

      ws.on('message', (data: string) => {
        try {
          const msg = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleClientMessage(ws, msg);
        } catch {
          // Ignore invalid frames
        }
      });

      ws.on('close', () => {
        this.clientSubscriptions.delete(ws);
      });

      // Send immediate welcome packet with live ticker
      MarketService.getLiveTicker().then((ticker) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            event: 'ticker_update',
            channel: 'market:ticker',
            data: ticker,
          }));
        }
      });
    });

    // Start background ticker broadcast loop
    this.startTickerBroadcast();

    return this.wss;
  }

  private static handleClientMessage(ws: WebSocket, msg: WebSocketMessage): void {
    const subs = this.clientSubscriptions.get(ws) || new Set<string>();

    switch (msg.type) {
      case 'subscribe':
        if (msg.channel) {
          subs.add(msg.channel);
          this.clientSubscriptions.set(ws, subs);
          ws.send(JSON.stringify({ event: 'subscribed', channel: msg.channel }));
        }
        break;

      case 'unsubscribe':
        if (msg.channel) {
          subs.delete(msg.channel);
          ws.send(JSON.stringify({ event: 'unsubscribed', channel: msg.channel }));
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
        break;

      case 'broadcast':
        if (msg.channel && msg.payload) {
          this.broadcastToChannel(msg.channel, {
            event: 'channel_broadcast',
            channel: msg.channel,
            data: msg.payload,
          });
        }
        break;
    }
  }

  static broadcastToChannel(channel: string, payload: any): void {
    const dataStr = JSON.stringify(payload);
    for (const [client, subs] of this.clientSubscriptions.entries()) {
      if (subs.has(channel) && client.readyState === WebSocket.OPEN) {
        client.send(dataStr);
      }
    }
  }

  private static startTickerBroadcast(): void {
    setInterval(async () => {
      if (!this.wss || this.wss.clients.size === 0) return;

      try {
        const ticker = await MarketService.getLiveTicker();
        // Add subtle synthetic jitter for alive feel if Binance REST API is cached
        const jitter = (Math.random() - 0.5) * 5;
        const liveData = {
          ...ticker,
          price: Math.round((ticker.price + jitter) * 100) / 100,
          lastUpdated: Date.now()
        };

        this.broadcastToChannel('market:ticker', {
          event: 'ticker_update',
          channel: 'market:ticker',
          data: liveData
        });
      } catch {
        // Silently tolerate network hiccups
      }
    }, 3000);
  }
}
