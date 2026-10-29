import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { useMarket } from '../context/MarketContext';
import { InteractiveChart } from '../components/InteractiveChart';

export const MarketsPage: React.FC = () => {
  const {
    btcPriceUsd,
    btcPriceNgn,
    priceChange24h,
    volume24h,
    usdToNgnRate,
    satsToNgn,
    ngnToSats,
    isLiveConnected,
  } = useMarket();

  // Instant Converter State
  const [swapMode, setSwapMode] = useState<'satsToNgn' | 'ngnToSats'>('satsToNgn');
  const [inputVal, setInputVal] = useState<string>('5000');
  const [swapSuccess, setSwapSuccess] = useState<string>('');

  const numInput = parseFloat(inputVal) || 0;
  const convertedVal = swapMode === 'satsToNgn' ? satsToNgn(numInput) : ngnToSats(numInput);

  const handleExecuteConvert = () => {
    if (numInput <= 0) return;
    setSwapSuccess(`Simulated instant zero-fee conversion of ${numInput.toLocaleString()} at live rate!`);
    setTimeout(() => setSwapSuccess(''), 4000);
  };

  // Mock real-time order book entries around live market price
  const basePrice = btcPriceUsd;
  const asks = [
    { price: (basePrice + 12).toFixed(2), amount: '0.4120', total: (basePrice * 0.412).toFixed(0) },
    { price: (basePrice + 8).toFixed(2), amount: '1.2450', total: (basePrice * 1.245).toFixed(0) },
    { price: (basePrice + 4).toFixed(2), amount: '0.8500', total: (basePrice * 0.85).toFixed(0) },
    { price: (basePrice + 1).toFixed(2), amount: '2.1400', total: (basePrice * 2.14).toFixed(0) },
  ];

  const bids = [
    { price: (basePrice - 1).toFixed(2), amount: '1.8500', total: (basePrice * 1.85).toFixed(0) },
    { price: (basePrice - 3).toFixed(2), amount: '0.9400', total: (basePrice * 0.94).toFixed(0) },
    { price: (basePrice - 7).toFixed(2), amount: '3.1200', total: (basePrice * 3.12).toFixed(0) },
    { price: (basePrice - 11).toFixed(2), amount: '1.4500', total: (basePrice * 1.45).toFixed(0) },
  ];

  return (
    <div className="page-container markets-page">
      {/* Top Binance Live Connection Banner */}
      <div className="markets-ticker-bar">
        <div className="ticker-item">
          <span className="ticker-label">Live Pair</span>
          <span className="ticker-value bold">BTC/USDT</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">Binance Spot Index</span>
          <span className="ticker-value highlight">${btcPriceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">Naira Equiv (1 BTC)</span>
          <span className="ticker-value">₦{btcPriceNgn.toLocaleString()} NGN</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">Parallel USD/NGN</span>
          <span className="ticker-value">₦{usdToNgnRate.toLocaleString()}</span>
        </div>
        <div className="ticker-item">
          <span className="ticker-label">WebSocket Status</span>
          <span className={`status-tag ${isLiveConnected ? 'connected' : 'connecting'}`}>
            {isLiveConnected ? '● Live Stream Connected' : '○ Connecting...'}
          </span>
        </div>
      </div>

      {/* Main Grid: Chart + Converter & Order Book */}
      <div className="fintech-grid-2col">
        {/* Left Column: Interactive Candlestick / Area Chart */}
        <div className="grid-col-primary">
          <InteractiveChart />

          {/* Market Pairs Table */}
          <div className="card pairs-table-card">
            <div className="card-header-between">
              <h3>African & Global Currency Pairs</h3>
              <span className="badge-tag">Zero Spread</span>
            </div>

            <div className="table-responsive">
              <table className="fintech-table">
                <thead>
                  <tr>
                    <th>Market Pair</th>
                    <th>Last Price</th>
                    <th>24h Change</th>
                    <th>24h Volume</th>
                    <th>Settlement Type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div className="pair-cell">
                        <span className="pair-badge btc">₿</span>
                        <div>
                          <strong>BTC / USDT</strong>
                          <span className="sub">Binance Primary Feed</span>
                        </div>
                      </div>
                    </td>
                    <td className="mono-num">${btcPriceUsd.toLocaleString()}</td>
                    <td>
                      <span className={`pill-badge ${priceChange24h >= 0 ? 'green' : 'red'}`}>
                        {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="mono-num">${(volume24h * btcPriceUsd / 1_000_000).toFixed(1)}M</td>
                    <td><span className="pill-badge orange">Lightning L2</span></td>
                  </tr>

                  <tr>
                    <td>
                      <div className="pair-cell">
                        <span className="pair-badge ngn">₦</span>
                        <div>
                          <strong>BTC / NGN</strong>
                          <span className="sub">Nigerian Parallel Rate</span>
                        </div>
                      </div>
                    </td>
                    <td className="mono-num">₦{btcPriceNgn.toLocaleString()}</td>
                    <td>
                      <span className={`pill-badge ${priceChange24h >= 0 ? 'green' : 'red'}`}>
                        {priceChange24h >= 0 ? '+' : ''}{priceChange24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="mono-num">₦3.8B</td>
                    <td><span className="pill-badge green">Instant NUBAN</span></td>
                  </tr>

                  <tr>
                    <td>
                      <div className="pair-cell">
                        <span className="pair-badge sats">⚡</span>
                        <div>
                          <strong>SATS / NGN</strong>
                          <span className="sub">Micro-Merchant Denomination</span>
                        </div>
                      </div>
                    </td>
                    <td className="mono-num">₦{(btcPriceNgn / 100_000_000).toFixed(3)}</td>
                    <td>
                      <span className="pill-badge green">+2.45%</span>
                    </td>
                    <td className="mono-num">1.4B sats</td>
                    <td><span className="pill-badge green">Offline Cashu</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Order Book & Instant FX Converter */}
        <div className="grid-col-secondary">
          {/* Instant FX Converter Widget */}
          <div className="card converter-card">
            <div className="card-header-between">
              <h3>Instant Swap & FX Converter</h3>
              <button
                type="button"
                className="icon-btn-round"
                onClick={() => setSwapMode(swapMode === 'satsToNgn' ? 'ngnToSats' : 'satsToNgn')}
                title="Invert conversion direction"
              >
                <ArrowRightLeft size={16} />
              </button>
            </div>

            <div className="converter-body">
              <div className="input-group-fintech">
                <label>{swapMode === 'satsToNgn' ? 'Satoshis to Convert' : 'Naira (NGN) to Convert'}</label>
                <div className="input-row-fintech">
                  <input
                    type="number"
                    className="fintech-input mono-num"
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="0"
                  />
                  <span className="input-addon-pill">
                    {swapMode === 'satsToNgn' ? 'SATS ⚡' : 'NGN ₦'}
                  </span>
                </div>
              </div>

              <div className="conversion-arrow-center">
                <div className="arrow-circle">↓</div>
              </div>

              <div className="input-group-fintech">
                <label>{swapMode === 'satsToNgn' ? 'You Receive in Naira (NGN)' : 'You Receive in Satoshis'}</label>
                <div className="result-display mono-num">
                  {swapMode === 'satsToNgn' ? `≈ ₦${convertedVal.toLocaleString()}` : `≈ ${convertedVal.toLocaleString()} sats`}
                </div>
              </div>

              <div className="fee-transparency-row">
                <span>Fee</span>
                <span className="green-text">0.00% (Direct Peer Protocol)</span>
              </div>
              <div className="fee-transparency-row">
                <span>Rate Guarantee</span>
                <span>Binance WebSocket Index</span>
              </div>

              {swapSuccess && (
                <div className="status-banner success">{swapSuccess}</div>
              )}

              <button
                type="button"
                className="btn-primary w-full mt-3"
                onClick={handleExecuteConvert}
              >
                Convert Instantly
              </button>
            </div>
          </div>

          {/* Real-time Order Book Depth */}
          <div className="card orderbook-card">
            <div className="card-header-between">
              <h3>BTC/USDT Order Book</h3>
              <span className="mono-num text-xs text-muted">Spread: $0.50</span>
            </div>

            <div className="orderbook-table">
              {/* Asks (Sell Orders) */}
              <div className="orderbook-half asks">
                {asks.map((ask, idx) => (
                  <div key={idx} className="order-row">
                    <span className="order-price red mono-num">{ask.price}</span>
                    <span className="order-amount mono-num">{ask.amount}</span>
                    <span className="order-total mono-num">${ask.total}</span>
                  </div>
                ))}
              </div>

              {/* Mid-Market Price Banner */}
              <div className="orderbook-mid-price">
                <span className="mid-val mono-num">${btcPriceUsd.toLocaleString()}</span>
                <span className="mid-icon">⚡ Live</span>
              </div>

              {/* Bids (Buy Orders) */}
              <div className="orderbook-half bids">
                {bids.map((bid, idx) => (
                  <div key={idx} className="order-row">
                    <span className="order-price green mono-num">{bid.price}</span>
                    <span className="order-amount mono-num">{bid.amount}</span>
                    <span className="order-total mono-num">${bid.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
