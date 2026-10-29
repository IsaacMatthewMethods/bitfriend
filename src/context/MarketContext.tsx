import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketContextType {
  btcPriceUsd: number;
  btcPriceNgn: number;
  priceChange24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  priceDirection: 'up' | 'down' | 'neutral';
  recentPrices: number[];
  candlesticks: CandlestickData[];
  isLiveConnected: boolean;
  usdToNgnRate: number;
  satsToNgn: (sats: number) => number;
  ngnToSats: (ngn: number) => number;
}

const DEFAULT_USD_NGN = 1585; // Current parallel Naira rate

const MarketContext = createContext<MarketContextType>({
  btcPriceUsd: 68500,
  btcPriceNgn: 68500 * DEFAULT_USD_NGN,
  priceChange24h: 2.45,
  high24h: 69200,
  low24h: 67100,
  volume24h: 24510.8,
  priceDirection: 'neutral',
  recentPrices: [67100, 67400, 67900, 68100, 68350, 68500],
  candlesticks: [],
  isLiveConnected: false,
  usdToNgnRate: DEFAULT_USD_NGN,
  satsToNgn: (sats: number) => Math.round((sats / 100_000_000) * (68500 * DEFAULT_USD_NGN)),
  ngnToSats: (ngn: number) => Math.round((ngn / (68500 * DEFAULT_USD_NGN)) * 100_000_000),
});

export const MarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [btcPriceUsd, setBtcPriceUsd] = useState<number>(68500);
  const [priceChange24h, setPriceChange24h] = useState<number>(2.45);
  const [high24h, setHigh24h] = useState<number>(69200);
  const [low24h, setLow24h] = useState<number>(67100);
  const [volume24h, setVolume24h] = useState<number>(24510.8);
  const [priceDirection, setPriceDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const [recentPrices, setRecentPrices] = useState<number[]>([67200, 67500, 67800, 68100, 68300, 68500]);
  const [candlesticks, setCandlesticks] = useState<CandlestickData[]>([]);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [usdToNgnRate] = useState<number>(DEFAULT_USD_NGN);

  const prevPriceRef = useRef<number>(68500);
  const wsRef = useRef<WebSocket | null>(null);

  const btcPriceNgn = Math.round(btcPriceUsd * usdToNgnRate);

  const satsToNgn = (sats: number): number => {
    if (!sats) return 0;
    return Math.round((sats / 100_000_000) * btcPriceNgn);
  };

  const ngnToSats = (ngn: number): number => {
    if (!ngn || !btcPriceNgn) return 0;
    return Math.round((ngn / btcPriceNgn) * 100_000_000);
  };

  // 1. Fetch initial 24h ticker & candlestick history from Binance REST API
  useEffect(() => {
    let isMounted = true;

    const fetchInitialData = async () => {
      try {
        // Fetch 24h ticker
        const tickerRes = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
        if (tickerRes.ok) {
          const data = await tickerRes.json();
          if (isMounted) {
            const price = parseFloat(data.lastPrice);
            setBtcPriceUsd(price);
            prevPriceRef.current = price;
            setPriceChange24h(parseFloat(data.priceChangePercent));
            setHigh24h(parseFloat(data.highPrice));
            setLow24h(parseFloat(data.lowPrice));
            setVolume24h(parseFloat(data.volume));
          }
        }

        // Fetch recent 1h klines for charting
        const klineRes = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24');
        if (klineRes.ok) {
          const klineData = await klineRes.json();
          if (isMounted && Array.isArray(klineData)) {
            const parsed: CandlestickData[] = klineData.map((d: any) => ({
              time: d[0],
              open: parseFloat(d[1]),
              high: parseFloat(d[2]),
              low: parseFloat(d[3]),
              close: parseFloat(d[4]),
            }));
            setCandlesticks(parsed);
            setRecentPrices(parsed.map(k => k.close));
          }
        }
      } catch (err) {
        console.warn('Binance REST API fallback active:', err);
      }
    };

    fetchInitialData();

    // 2. Connect to live Binance WebSocket for continuous real-time market updates
    try {
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) setIsLiveConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.c) {
            const newPrice = parseFloat(data.c);
            const prevPrice = prevPriceRef.current;

            if (newPrice > prevPrice) {
              setPriceDirection('up');
            } else if (newPrice < prevPrice) {
              setPriceDirection('down');
            }

            prevPriceRef.current = newPrice;
            setBtcPriceUsd(newPrice);
            if (data.P) setPriceChange24h(parseFloat(data.P));
            if (data.h) setHigh24h(parseFloat(data.h));
            if (data.l) setLow24h(parseFloat(data.l));
            if (data.v) setVolume24h(parseFloat(data.v));

            setRecentPrices((prev) => {
              const updated = [...prev.slice(-20), newPrice];
              return updated;
            });
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        if (isMounted) setIsLiveConnected(false);
      };

      ws.onclose = () => {
        if (isMounted) setIsLiveConnected(false);
      };
    } catch (wsErr) {
      console.warn('Could not connect to Binance WS:', wsErr);
    }

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <MarketContext.Provider
      value={{
        btcPriceUsd,
        btcPriceNgn,
        priceChange24h,
        high24h,
        low24h,
        volume24h,
        priceDirection,
        recentPrices,
        candlesticks,
        isLiveConnected,
        usdToNgnRate,
        satsToNgn,
        ngnToSats,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
};

export const useMarket = () => useContext(MarketContext);
