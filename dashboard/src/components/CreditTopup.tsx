import React, { useState } from 'react';
import { apiPost } from '../utils/api';

export const CreditTopup: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (priceId: string) => {
    setLoading(true);
    try {
      const { url } = await apiPost('/api/stripe/create-checkout', { priceId });
      if (url) window.location.href = url;
    } catch (err) {
      alert('Stripe Fehler: ' + err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 rounded-xl border border-slate-800">
      <h2 className="text-xl font-bold text-white mb-4">Credits aufladen</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { id: 'price_1', name: '100 Credits', price: '10€' },
          { id: 'price_2', name: '500 Credits', price: '40€' },
          { id: 'price_3', name: '1000 Credits', price: '70€' }
        ].map((pkg) => (
          <button
            key={pkg.id}
            disabled={loading}
            onClick={() => handlePurchase(pkg.id)}
            className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <div className="font-bold">{pkg.name}</div>
            <div className="text-sm opacity-80">{pkg.price}</div>
          </button>
        ))}
      </div>
    </div>
  );
};
export default CreditTopup;
