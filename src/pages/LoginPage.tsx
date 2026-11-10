import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Phone,
  Lock,
  ArrowRight,
  UserCheck,
  AlertCircle,
  Users,
  Sparkles,
} from 'lucide-react';
import { useApp, INITIAL_MEMBERS } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { CountrySelector } from '../components/common/CountrySelector';
import { getCountryByCode, validatePhoneNumber, CountryData } from '../utils/countries';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginMobileUser, switchUser, familyMembers } = useApp();

  const [activeTab, setActiveTab] = useState<'mobile' | 'demo'>('mobile');

  // Mobile login state
  const [selectedCountry, setSelectedCountry] = useState<CountryData>(() => getCountryByCode('+91'));
  const [countryCode, setCountryCode] = useState('+91');
  const [mobileNumber, setMobileNumber] = useState('');
  const [generatedOTP, setGeneratedOTP] = useState<string | null>(null);
  const [enteredOTP, setEnteredOTP] = useState('');
  const [isOTPSent, setIsOTPSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Demo user login state
  const [selectedDemoUser, setSelectedDemoUser] = useState(familyMembers[0]?.id || 'usr_owner_rajesh');

  const handleSendLoginOTP = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validatePhoneNumber(mobileNumber, selectedCountry);
    if (!validation.valid) {
      setErrorMessage(validation.error || 'Please enter a valid mobile number.');
      return;
    }

    const mockOTP = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOTP(mockOTP);
    setIsOTPSent(true);
  };

  const handleVerifyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (enteredOTP.trim() !== generatedOTP) {
      setErrorMessage('Invalid verification code. Please check the simulated OTP.');
      return;
    }

    setIsLoading(true);
    const result = await loginMobileUser(selectedCountry.dialCode, mobileNumber);
    setIsLoading(false);

    if (result.success && result.user) {
      const u = result.user;
      // If user onboarding was incomplete, resume from saved step
      if (u.onboardingStep === 'bank') {
        navigate('/register?step=2');
      } else if (u.onboardingStep === 'family_choice') {
        navigate('/register?step=3');
      } else if (u.onboardingStep === 'pending_approval') {
        navigate('/register?step=4');
      } else {
        // Complete onboarding: open correct dashboard
        navigate('/dashboard');
      }
    } else {
      setErrorMessage(result.error || 'Failed to sign in.');
    }
  };

  const handleDemoLogin = (userId: string) => {
    switchUser(userId);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-fintech-bg flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-4 group">
          <div className="w-10 h-10 rounded-xl bg-fintech-primary flex items-center justify-center text-white font-bold text-xl shadow-sm group-hover:scale-105 transition-transform">
            P
          </div>
          <span className="font-bold text-2xl text-fintech-navy">PayPal</span>
          <span className="font-bold text-2xl text-fintech-primary">Family</span>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-fintech-navy tracking-tight">
          Welcome Back
        </h2>
        <p className="mt-1 text-xs text-fintech-muted">
          Log in with your registered mobile number or explore demo personas.
        </p>

        {/* Tab Switcher */}
        <div className="mt-6 grid grid-cols-2 gap-2 p-1 bg-slate-200/70 rounded-xl max-w-sm mx-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('mobile');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'mobile'
                ? 'bg-white text-fintech-navy shadow-xs'
                : 'text-fintech-muted hover:text-fintech-text'
            }`}
          >
            <Phone className="w-3.5 h-3.5 text-fintech-primary" />
            <span>Mobile Login</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('demo');
              setErrorMessage(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'demo'
                ? 'bg-white text-fintech-navy shadow-xs'
                : 'text-fintech-muted hover:text-fintech-text'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-fintech-primary" />
            <span>Demo Accounts</span>
          </button>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="shadow-elevated p-6 sm:p-8">
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-fintech-error flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-fintech-error shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: RETURNING REGISTERED MOBILE USER */}
          {activeTab === 'mobile' && (
            <div>
              {!isOTPSent ? (
                <form onSubmit={handleSendLoginOTP} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                      Registered Mobile Number
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <div className="sm:col-span-2">
                        <CountrySelector
                          selectedCountry={selectedCountry}
                          onChange={(c) => {
                            setSelectedCountry(c);
                            setCountryCode(c.dialCode);
                          }}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="tel"
                          value={mobileNumber}
                          onChange={(e) => setMobileNumber(e.target.value)}
                          placeholder={selectedCountry.placeholder}
                          required
                          autoFocus
                          className="w-full h-full min-h-[42px] px-3.5 py-2 rounded-lg border border-fintech-border text-sm focus:outline-none focus:ring-2 focus:ring-fintech-primary font-mono tracking-wide"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-fintech-muted mt-1">
                      Enter the mobile number you used during registration.
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-fintech-navy flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-fintech-primary shrink-0 mt-0.5" />
                    <span>
                      A simulated OTP will verify your account and open your role-based dashboard.
                    </span>
                  </div>

                  <Button type="submit" variant="primary" size="lg" className="w-full mt-2">
                    Send Login Code (OTP) &rarr;
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyLogin} className="space-y-4">
                  {/* Simulated SMS Banner */}
                  <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                        <Phone className="w-4 h-4 text-emerald-600" />
                        <span>Simulated Login SMS</span>
                      </div>
                      <Badge variant="simulated">OTP Delivered</Badge>
                    </div>
                    <p className="text-xs text-emerald-800">
                      Code sent to <strong>{countryCode} {mobileNumber}</strong>:
                    </p>
                    <div className="p-2 bg-white border border-emerald-200 rounded-lg flex items-center justify-between">
                      <span className="font-mono text-sm tracking-widest font-extrabold text-emerald-950">
                        {generatedOTP}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (generatedOTP) setEnteredOTP(generatedOTP);
                        }}
                        className="text-[11px] font-bold text-fintech-primary hover:underline bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
                      >
                        Auto-fill OTP
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-fintech-navy mb-1.5">
                      Enter Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={enteredOTP}
                      onChange={(e) => setEnteredOTP(e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 582910"
                      required
                      autoFocus
                      className="w-full text-center text-xl font-mono tracking-widest py-2.5 rounded-lg border border-fintech-border focus:outline-none focus:ring-2 focus:ring-fintech-primary"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => setIsOTPSent(false)}
                      className="w-1/3"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      isLoading={isLoading}
                      className="w-2/3"
                    >
                      Verify & Log In &rarr;
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: EXPLORE DEMO PERSONAS */}
          {activeTab === 'demo' && (
            <div className="space-y-4">
              <div className="text-xs text-fintech-muted mb-2">
                Select a family persona below to access their dashboard:
              </div>

              <div className="space-y-2">
                {INITIAL_MEMBERS.map((member) => {
                  const isOwner = member.role === 'owner';
                  return (
                    <button
                      type="button"
                      key={member.id}
                      onClick={() => handleDemoLogin(member.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl border border-fintech-border hover:border-fintech-primary hover:bg-blue-50/50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={member.avatarUrl}
                          alt={member.name}
                          className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 group-hover:ring-fintech-primary"
                        />
                        <div>
                          <div className="text-xs font-bold text-fintech-text group-hover:text-fintech-primary">
                            {member.name}
                          </div>
                          <div className="text-[11px] text-fintech-muted">{member.relationship}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={isOwner ? 'primary' : 'neutral'} size="sm">
                          {isOwner ? 'Administrator' : 'Member'}
                        </Badge>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-fintech-primary group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-fintech-muted flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-fintech-primary shrink-0 mt-0.5" />
                <span>
                  Experience family financial oversight, allowance requests, and merchant QR payments from each family role.
                </span>
              </div>
            </div>
          )}

          {/* Bottom link to Register */}
          <div className="mt-6 pt-5 border-t border-fintech-border text-center space-y-2">
            <div className="text-xs text-fintech-muted">New to PayPal Family?</div>
            <Link
              to="/register"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-fintech-primary hover:underline"
            >
              <span>Register a New Account</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
