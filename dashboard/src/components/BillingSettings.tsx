import { CreditTopup } from './CreditTopup';
import React, { useState, useEffect } from 'react';

export const BillingSettings: React.FC = () => {
  const [plan, setPlan] = useState('Loading...');
  const [loading, setLoading] = useState(false);

  const getHeaders = () => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  };

  useEffect(() => {
    fetch('/api/user/plan', { headers: getHeaders() })
      .then(r => r.json())
      .then(res => { if (res.ok) setPlan(res.plan); })
      .catch(() => setPlan('basis'));
  }, []);

  const manageBilling = async () => {
    setLoading(true);
    const res = await fetch('/api/stripe/create-portal-session', { method: 'POST', headers: getHeaders() }).then(r => r.json());
    if (res.ok && res.url) window.location.href = res.url;
    setLoading(false);
  };

  const upgrade = async (newPlan: string) => {
    setLoading(true);
    const res = await fetch('/api/stripe/create-checkout-session', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ plan: newPlan }) }).then(r => r.json());
    if (res.ok && res.url) window.location.href = res.url;
    setLoading(false);
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Billing & Subscription</h3>
      <p className="text-gray-400 mb-6">Current active plan: <span className="font-bold text-white uppercase ml-2 px-2 py-1 bg-gray-800 rounded">{plan}</span></p>
      
      <div className="flex gap-4">
        {plan === 'basis' && (
          <button disabled={loading} onClick={() => upgrade('pro')} className="bg-green-600 hover:bg-green-500 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50">Upgrade to Pro</button>
        )}
        {plan !== 'basis' && plan !== 'Loading...' && (
          <button disabled={loading} onClick={manageBilling} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50">Manage Subscription</button>
        )}
      </div>
      <CreditTopup />
    </div>
  );
};
