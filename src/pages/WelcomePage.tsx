import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  QrCode,
  Sliders,
  Sparkles,
  ArrowRight,
  Users,
  CheckCircle2,
  Lock,
  Wallet,
  Coins,
} from 'lucide-react';
import { useApp, INITIAL_MEMBERS } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { switchUser } = useApp();

  const handleDemoLogin = (userId: string) => {
    switchUser(userId);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-fintech-bg text-fintech-text flex flex-col">
      {/* Top Banner */}
      <div className="bg-fintech-navy text-white text-xs px-4 py-2 text-center flex items-center justify-center gap-2">
        <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-semibold text-[11px] border border-blue-500/30">
          PAYPAL FAMILY
        </span>
        <span>
          Smart Family Allowance & Spending Controls • Instant QR Payments & Automated Allowance
        </span>
      </div>

      {/* Hero Navbar */}
      <header className="border-b border-fintech-border bg-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group cursor-pointer" title="PayPal Family">
            <div className="w-10 h-10 rounded-xl bg-fintech-primary flex items-center justify-center text-white font-bold text-xl shadow-sm group-hover:scale-105 transition-transform">
              P
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-xl text-fintech-navy">PayPal</span>
                <span className="font-bold text-xl text-fintech-primary">Family</span>
              </div>
              <p className="text-[10px] text-fintech-muted uppercase font-semibold">Spending & Allowance Sandbox</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/login')}
              className="font-bold text-fintech-navy border-fintech-border hover:border-fintech-primary hover:text-fintech-primary bg-white shadow-xs"
            >
              Login
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/register')}
              className="font-bold shadow-xs"
            >
              Register
            </Button>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-fintech-primary text-xs font-semibold mb-6">
          <ShieldCheck className="w-4 h-4" />
          <span>Smart Fintech Family Financial Controls</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-fintech-navy tracking-tight max-w-4xl mx-auto leading-tight">
          Empower your family with <span className="text-fintech-primary">guided financial freedom</span>.
        </h1>

        <p className="mt-6 text-base sm:text-lg text-fintech-muted max-w-2xl mx-auto leading-relaxed">
          One central family fund. Configurable daily and monthly spending allowances. Instant QR payments at merchants and automated money requests.
        </p>

        {/* Demo Account Fast-Start Cards */}
        <div className="mt-12 bg-white rounded-2xl border border-fintech-border shadow-elevated p-6 sm:p-8 max-w-3xl mx-auto">
          <div className="flex items-center justify-between pb-4 border-b border-fintech-border/70 mb-6">
            <div className="text-left">
              <h2 className="text-lg font-semibold text-fintech-navy">Explore Immediate Demo Accounts</h2>
              <p className="text-xs text-fintech-muted">Experience family allowance management with pre-configured family roles.</p>
            </div>
            <Badge variant="primary">Fast Demo</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {INITIAL_MEMBERS.map((member) => {
              const isOwner = member.role === 'owner';
              return (
                <div
                  key={member.id}
                  onClick={() => handleDemoLogin(member.id)}
                  className="group cursor-pointer rounded-xl border border-fintech-border p-4 text-left hover:border-fintech-primary hover:shadow-card-hover transition-all bg-slate-50/50 hover:bg-white"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={member.avatarUrl}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200 group-hover:ring-fintech-primary"
                    />
                    <div>
                      <div className="text-sm font-semibold text-fintech-text group-hover:text-fintech-primary">
                        {member.name}
                      </div>
                      <Badge variant={isOwner ? 'primary' : 'neutral'} size="sm">
                        {isOwner ? 'Admin' : 'Member'}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-xs text-fintech-muted mb-4 line-clamp-2">
                    {isOwner
                      ? 'Controls family pool (₹10,000), sets spending limits, and manages permissions.'
                      : member.id === 'usr_member_priya'
                      ? 'College student with ₹500 balance and ₹5,000 daily limit, tests transfers & QR payments.'
                      : 'School student with ₹800 daily limit, tests strict limit enforcement.'}
                  </p>

                  <div className="flex items-center justify-between text-xs font-semibold text-fintech-primary pt-2 border-t border-slate-200">
                    <span>Enter Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="bg-white border-y border-fintech-border py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-fintech-navy">
              Designed for Real-World Family Spending
            </h2>
            <p className="text-sm text-fintech-muted mt-2">
              Every control engineered with banking-grade UX and mathematical precision.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="hover:border-fintech-primary transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-fintech-primary flex items-center justify-center mb-4">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-fintech-navy mb-2">Granular Spending Controls</h3>
              <p className="text-sm text-fintech-muted leading-relaxed">
                Configure single-transaction, daily, and monthly limits per family member. Toggle merchant QR payments or direct money transfers independently.
              </p>
            </Card>

            <Card className="hover:border-fintech-primary transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-fintech-navy mb-2">QR Merchant Scan & Pay</h3>
              <p className="text-sm text-fintech-muted leading-relaxed">
                Scan supported QR codes at cafes, bookstores, and transit hubs. Payments debit directly from the family pool without exceeding member allowances.
              </p>
            </Card>

            <Card className="hover:border-fintech-primary transition-all">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-fintech-navy mb-2">AI Spending Assistant</h3>
              <p className="text-sm text-fintech-muted leading-relaxed">
                Receive contextual budget advice, explanation of rejected transactions, and intelligent family expenditure summaries powered by local financial rules.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-slate-900 text-slate-400 py-10 px-6 text-xs border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-left">
          <div>
            <div className="font-bold text-white text-sm">PayPal Family</div>
            <p className="mt-1 text-slate-400">
              Modern fintech family spending and allowance management system.
            </p>
          </div>
          <div className="text-slate-400">
            TypeScript • React • Tailwind CSS • Vite
          </div>
        </div>
      </footer>
    </div>
  );
};

