import React, { useState } from 'react';

export const TwoFactorSettings: React.FC = () => {
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [code, setCode] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [msg, setMsg] = useState('');

  const getHeaders = () => {
    const token = document.cookie.split('; ').find(row => row.startsWith('se_token='))?.split('=')[1] || localStorage.getItem('token') || '';
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  };

  const startSetup = async () => {
    const res = await fetch('/api/auth/2fa/setup', { method: 'POST', headers: getHeaders() }).then(r => r.json());
    if (res.ok) {
      setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(res.otpauth_uri)}`);
    } else {
      setMsg(res.error || 'Setup failed');
    }
  };

  const verifySetup = async () => {
    const res = await fetch('/api/auth/2fa/verify-setup', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ code }) }).then(r => r.json());
    if (res.ok) {
      setEnabled(true);
      setQrCodeUrl('');
      setMsg('2FA Successfully Enabled!');
    } else {
      setMsg(res.error || 'Verification failed');
    }
  };

  return (
    <div className="p-6 border border-gray-800 bg-gray-900/50 rounded-xl mt-6">
      <h3 className="text-xl font-bold mb-2 text-white">Two-Factor Authentication</h3>
      {msg && <p className="mb-4 text-sm font-medium text-blue-400">{msg}</p>}
      
      {enabled ? (
        <p className="text-green-400 font-medium">Your account is secured with 2FA.</p>
      ) : qrCodeUrl ? (
        <div className="flex flex-col gap-4 max-w-sm">
          <p className="text-gray-300">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):</p>
          <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48 bg-white p-2 rounded-lg" />
          <input type="text" placeholder="Enter 6-digit code" className="p-3 rounded-lg bg-gray-800 text-white border border-gray-700" value={code} onChange={e => setCode(e.target.value)} />
          <button onClick={verifySetup} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-lg transition-colors">Verify & Enable</button>
        </div>
      ) : (
        <div>
          <p className="text-gray-400 mb-4">Add an extra layer of security to your account to prevent unauthorized access.</p>
          <button onClick={startSetup} className="bg-white hover:bg-gray-200 text-black font-semibold px-4 py-2 rounded-lg transition-colors">Setup 2FA</button>
        </div>
      )}
    </div>
  );
};
