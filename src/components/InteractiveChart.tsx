import React, { useState, useMemo } from 'react';
import { useMarket } from '../context/MarketContext';

export const InteractiveChart: React.FC = () => {
  const { btcPriceUsd, priceChange24h, high24h, low24h, candlesticks, recentPrices } = useMarket();
  const [timeframe, setTimeframe] = useState<'1H' | '24H' | '7D' | '1M'>('24H');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Generate smooth price points
  const points = useMemo(() => {
    if (candlesticks.length > 5) {
      return candlesticks.map((c) => c.close);
    }
    // Fallback if websocket/REST hasn't delivered 24 klines yet
    const base = btcPriceUsd;
    const history = recentPrices.length > 5 ? recentPrices : [
      base * 0.985,
      base * 0.989,
      base * 0.993,
      base * 0.988,
      base * 0.994,
      base * 0.998,
      base * 1.002,
      base * 1.001,
      base * 1.005,
      base,
    ];
    return history;
  }, [candlesticks, recentPrices, btcPriceUsd]);

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const width = 800;
  const height = 260;
  const paddingY = 24;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - paddingY - ((val - min) / range) * (height - paddingY * 2);
    return { x, y, val };
  });

  const pathD = coords.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  const isPositive = priceChange24h >= 0;
  const strokeColor = isPositive ? '#10B981' : '#EF4444';
  const fillGradientId = isPositive ? 'chartGradPos' : 'chartGradNeg';

  const activePoint = hoverIndex !== null && coords[hoverIndex] ? coords[hoverIndex] : coords[coords.length - 1];

  return (
    <div className="fintech-chart-card">
      <div className="chart-header">
        <div>
          <div className="chart-ticker-title">Bitcoin (BTC) / Tether (USDT)</div>
          <div className="chart-active-price">
            ${activePoint ? activePoint.val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : btcPriceUsd.toLocaleString()}
            <span className={`chart-change-tag ${isPositive ? 'pos' : 'neg'}`}>
              {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Timeframe selector tabs */}
        <div className="timeframe-pills">
          {(['1H', '24H', '7D', '1M'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              className={`tf-pill ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Interactive Candlestick / Line Chart */}
      <div className="chart-svg-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="chart-svg"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="chartGradPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="chartGradNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area under curve */}
          <path d={areaD} fill={`url(#${fillGradientId})`} />

          {/* Line curve */}
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Crosshair & active point marker */}
          {activePoint && (
            <>
              <line
                x1={activePoint.x}
                y1="0"
                x2={activePoint.x}
                y2={height}
                stroke="rgba(255, 255, 255, 0.15)"
                strokeDasharray="4 4"
              />
              <circle cx={activePoint.x} cy={activePoint.y} r="5" fill={strokeColor} stroke="#0B0E14" strokeWidth="2" />
            </>
          )}

          {/* Invisible hover capture rects */}
          {coords.map((c, i) => (
            <rect
              key={i}
              x={i === 0 ? 0 : (coords[i - 1].x + c.x) / 2}
              y={0}
              width={width / coords.length}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(i)}
            />
          ))}
        </svg>
      </div>

      {/* 24h Stat Bar */}
      <div className="chart-stats-footer">
        <div className="stat-col">
          <span className="stat-label">24h High</span>
          <span className="stat-val">${high24h.toLocaleString()}</span>
        </div>
        <div className="stat-col">
          <span className="stat-label">24h Low</span>
          <span className="stat-val">${low24h.toLocaleString()}</span>
        </div>
        <div className="stat-col">
          <span className="stat-label">Execution Speed</span>
          <span className="stat-val highlight">&lt; 10ms (Offline Peer)</span>
        </div>
        <div className="stat-col">
          <span className="stat-label">Data Mode</span>
          <span className="stat-val highlight">Zero-Data Ecash</span>
        </div>
      </div>
    </div>
  );
};
