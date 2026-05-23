import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Hash, Lock, ArrowRight, Loader } from 'lucide-react';
import { api } from '../utils/api';
import { useApp } from '../store/AppContext';

export default function LoginPage() {
  const { actions } = useApp();
  const [step, setStep] = useState('phone'); // phone | code | 2fa
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePhone(e) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await api.sendCode(phone.trim());
      setPhoneCodeHash(res.phone_code_hash);
      setStep('code');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function handleCode(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await api.verifyCode({ phone_code_hash: phoneCodeHash, code: code.trim() });
      if (res.needs_2fa) {
        setStep('2fa');
      } else {
        actions.login(res.token, res.user);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function handle2FA(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.verifyCode({ phone_code_hash: phoneCodeHash, code: code.trim(), password });
      actions.login(res.token, res.user);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const stepConfig = {
    phone: { icon: Phone, title: 'Enter your number', sub: 'We\'ll send a code via Telegram', placeholder: '+91 98765 43210', value: phone, set: setPhone, handler: handlePhone },
    code:  { icon: Hash,  title: 'Enter the code',   sub: `Code sent to ${phone}`,            placeholder: '12345',           value: code,  set: setCode,  handler: handleCode  },
    '2fa': { icon: Lock,  title: 'Two-step password', sub: 'Your account has 2FA enabled',     placeholder: '••••••••',        value: password, set: setPassword, handler: handle2FA },
  };

  const cfg = stepConfig[step];
  const Icon = cfg.icon;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-purple-600/8 blur-[100px]" />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',backgroundSize:'60px 60px'}} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/30"
          >
            <span className="text-2xl font-black text-white">A</span>
          </motion.div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AirBooks</h1>
          <p className="text-sm text-white/40 mt-1">Your Telegram media library</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-3xl p-8 backdrop-blur-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <Icon size={18} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">{cfg.title}</h2>
                  <p className="text-xs text-white/40">{cfg.sub}</p>
                </div>
              </div>

              <form onSubmit={cfg.handler}>
                <input
                  type={step === '2fa' ? 'password' : step === 'code' ? 'number' : 'tel'}
                  value={cfg.value}
                  onChange={e => cfg.set(e.target.value)}
                  placeholder={cfg.placeholder}
                  autoFocus
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl px-4 py-3.5 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/60 focus:bg-white/[0.08] transition-all mb-4"
                />

                {error && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="text-red-400 text-xs mb-4 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </motion.p>
                )}

                <button
                  type="submit"
                  disabled={loading || !cfg.value.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                  {loading ? <Loader size={16} className="animate-spin" /> : (
                    <>{step === 'phone' ? 'Send Code' : 'Continue'} <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              {step !== 'phone' && (
                <button onClick={() => { setStep('phone'); setCode(''); setError(''); }}
                  className="w-full text-center text-xs text-white/30 hover:text-white/60 mt-3 transition-colors">
                  Use a different number
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-white/20 mt-6">
          By continuing you agree to Telegram's Terms of Service
        </p>
      </motion.div>
    </div>
  );
}
