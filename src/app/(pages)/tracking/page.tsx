'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface TrackData {
  success: boolean;
  orderId: string;
  status: string;
  customerLat?: number;
  customerLng?: number;
  restaurantLat?: number;
  restaurantLng?: number;
  inHouseDelivery?: boolean;
  borzoTrackingUrl?: string;
  agentName?: string;
  agentPhone?: string;
  deliveryOtp?: string;
  estimatedMinutes?: number;
}

const STATUS_STEPS = [
  { key: 'Pending',           label: 'Order Placed',       icon: '📋', desc: 'Your order has been received' },
  { key: 'Preparing',         label: 'Preparing',          icon: '👩‍🍳', desc: 'The kitchen is cooking your food' },
  { key: 'Out for Delivery',  label: 'Out for Delivery',   icon: '🛵', desc: 'Your food is on the way!' },
  { key: 'Completed',         label: 'Delivered',          icon: '✅', desc: 'Enjoy your meal!' },
];

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

function StaticMapPlaceholder({ status }: { status: string }) {
  const isDelivering = status === 'Out for Delivery';
  return (
    <div style={{
      width: '100%', height: '100%', background: 'linear-gradient(135deg, #e8f4f8 0%, #d4edda 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Road lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }} viewBox="0 0 400 300">
        <line x1="50" y1="150" x2="350" y2="150" stroke="#555" strokeWidth="8" strokeDasharray="20,10"/>
        <line x1="200" y1="20" x2="200" y2="280" stroke="#555" strokeWidth="6" strokeDasharray="15,8"/>
      </svg>

      {/* Restaurant marker */}
      <div style={{
        position: 'absolute', top: '30%', left: '20%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          background: '#f97316', borderRadius: '50%', width: 44, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: '0 3px 10px rgba(249,115,22,0.4)', border: '3px solid white',
        }}>🍲</div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#92400e', marginTop: 4, background: 'white', padding: '2px 6px', borderRadius: 8 }}>Restaurant</span>
      </div>

      {/* Delivery bike (animated when out for delivery) */}
      {isDelivering && (
        <div style={{
          position: 'absolute', top: '40%', left: '45%',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          animation: 'bikeMove 3s ease-in-out infinite alternate',
        }}>
          <div style={{
            background: '#3b82f6', borderRadius: '50%', width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, boxShadow: '0 3px 10px rgba(59,130,246,0.4)', border: '3px solid white',
          }}>🛵</div>
          <span style={{ fontSize: 10, color: '#1e40af', marginTop: 3, background: 'white', padding: '2px 6px', borderRadius: 8, fontWeight: 600 }}>On the way</span>
        </div>
      )}

      {/* Customer marker */}
      <div style={{
        position: 'absolute', bottom: '20%', right: '15%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          background: '#22c55e', borderRadius: '50%', width: 44, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: '0 3px 10px rgba(34,197,94,0.4)', border: '3px solid white',
        }}>🏠</div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#166534', marginTop: 4, background: 'white', padding: '2px 6px', borderRadius: 8 }}>Your Location</span>
      </div>

      {/* Dotted route line */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 400 300">
        <path d="M 100 120 Q 200 80 280 220" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="8,5" opacity="0.6"/>
      </svg>

      <style>{`
        @keyframes bikeMove {
          from { transform: translateX(-20px); }
          to   { transform: translateX(20px); }
        }
      `}</style>
    </div>
  );
}

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [data, setData] = useState<TrackData | null>(null);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchTracking = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/track/${orderId}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        // Stop polling once delivered or cancelled
        if (['Completed', 'Rejected', 'Cancelled', 'Failed'].includes(json.status)) {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } else {
        setError(json.message || 'Order not found.');
      }
    } catch {
      setError('Failed to load tracking info.');
    }
  }, [orderId]);

  useEffect(() => {
    fetchTracking();
    intervalRef.current = setInterval(fetchTracking, 15000); // Poll every 15s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchTracking]);

  const currentStep = data ? getStepIndex(data.status) : 0;
  const isFailed = data && ['Rejected', 'Cancelled', 'Failed'].includes(data.status);

  if (!orderId) return (
    <div style={{ paddingTop: '6rem', textAlign: 'center' }}>
      <p style={{ color: '#ef4444', fontSize: '1.1rem' }}>❌ No order ID provided.</p>
      <a href="/my-orders" style={{ color: '#f97316', textDecoration: 'none', fontWeight: 600 }}>← Back to My Orders</a>
    </div>
  );

  return (
    <>
      <Navbar scrolled />
      <div className="tracking-body">
        <div className="tracking-page">
          <div className="tracking-container">

            {/* Map area */}
            <div className="tracking-map">
              {data ? (
                <StaticMapPlaceholder status={data.status} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
                  <span style={{ color: '#6b7280' }}>Loading map…</span>
                </div>
              )}
            </div>

            {/* Details panel */}
            <div className="tracking-details">

              {error ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <p style={{ fontSize: '2rem' }}>😕</p>
                  <p style={{ color: '#ef4444', fontWeight: 600 }}>{error}</p>
                  <a href="/my-orders" style={{ color: '#f97316', fontWeight: 600, textDecoration: 'none' }}>← My Orders</a>
                </div>
              ) : !data ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⏳</div>
                  <p style={{ color: '#6b7280' }}>Loading your order…</p>
                </div>
              ) : (
                <>
                  {/* ETA header */}
                  <div className="eta-header">
                    {isFailed ? (
                      <>
                        <div className="eta-title">Order Status</div>
                        <div className="eta-time" style={{ color: '#ef4444' }}>{data.status}</div>
                      </>
                    ) : data.status === 'Completed' ? (
                      <>
                        <div className="eta-title">Delivered!</div>
                        <div className="eta-time">✅ Enjoy your meal</div>
                      </>
                    ) : data.status === 'Out for Delivery' ? (
                      <>
                        <div className="eta-title">Estimated Arrival</div>
                        <div className="eta-time">25–40 min 🛵</div>
                      </>
                    ) : (
                      <>
                        <div className="eta-title">Order Status</div>
                        <div className="eta-time" style={{ fontSize: '1.6rem' }}>
                          {STATUS_STEPS[currentStep]?.icon} {data.status}
                        </div>
                      </>
                    )}
                    <p style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0 0' }}>
                      Order #{String(data.orderId).slice(-5)} · Auto-refreshes every 15s
                    </p>
                  </div>

                  {/* Progress stepper */}
                  {!isFailed && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                      {STATUS_STEPS.map((step, i) => {
                        const done = i <= currentStep;
                        const active = i === currentStep;
                        return (
                          <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_STEPS.length - 1 ? 1 : undefined }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 52 }}>
                              <div style={{
                                width: 40, height: 40, borderRadius: '50%',
                                background: done ? (active ? '#f97316' : '#22c55e') : '#e5e7eb',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 18, transition: 'all 0.3s',
                                boxShadow: active ? '0 0 0 4px rgba(249,115,22,0.2)' : 'none',
                              }}>
                                {done && !active ? '✓' : step.icon}
                              </div>
                              <span style={{ fontSize: 10, color: done ? '#374151' : '#9ca3af', fontWeight: done ? 600 : 400, textAlign: 'center', lineHeight: 1.3 }}>
                                {step.label}
                              </span>
                            </div>
                            {i < STATUS_STEPS.length - 1 && (
                              <div style={{
                                flex: 1, height: 3, margin: '0 4px', marginBottom: 16,
                                background: i < currentStep ? '#22c55e' : '#e5e7eb',
                                borderRadius: 2, transition: 'background 0.3s',
                              }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Status description */}
                  <div style={{
                    background: '#faf8f4', borderRadius: 12, padding: '14px 16px',
                    border: '1px solid #f0e6d2', textAlign: 'center',
                  }}>
                    <p style={{ margin: 0, fontSize: 14, color: '#374151', fontWeight: 500 }}>
                      {isFailed
                        ? '😔 This order was not completed. Contact us if you need help.'
                        : STATUS_STEPS[currentStep]?.desc}
                    </p>
                  </div>

                  {/* Agent card (if in-house delivery assigned) */}
                  {data.inHouseDelivery && data.agentName && data.status === 'Out for Delivery' && (
                    <div className="agent-card">
                      <div className="agent-info-left">
                        <div className="agent-avatar">{data.agentName.charAt(0).toUpperCase()}</div>
                        <div className="agent-text">
                          <h4>{data.agentName}</h4>
                          <p>Your delivery partner</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {data.agentPhone && (
                          <a href={`tel:${data.agentPhone}`} className="agent-action-btn call-btn" title="Call agent">📞</a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Borzo external tracking */}
                  {data.borzoTrackingUrl && (
                    <a
                      href={data.borzoTrackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        background: '#1d4ed8', color: 'white', padding: '12px 20px', borderRadius: 12,
                        textDecoration: 'none', fontWeight: 600, fontSize: 14,
                      }}
                    >
                      🗺️ Track Live on Borzo
                    </a>
                  )}

                  {/* Delivery OTP */}
                  {data.deliveryOtp && data.status === 'Out for Delivery' && (
                    <div style={{
                      background: '#fef3c7', border: '1.5px dashed #f59e0b', borderRadius: 12, padding: '14px 18px', textAlign: 'center',
                    }}>
                      <p style={{ margin: '0 0 4px', fontSize: 12, color: '#92400e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Delivery OTP — Share with rider
                      </p>
                      <p style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#78350f', letterSpacing: 6 }}>{data.deliveryOtp}</p>
                    </div>
                  )}

                  {/* Back link */}
                  <a href="/my-orders" style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, textDecoration: 'none', display: 'block' }}>
                    ← Back to My Orders
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
