import { useState, useEffect } from 'react';
import { Zap, Users, Trophy, Shield } from 'lucide-react';
import AuthForm from '@/components/AuthForm';
import { API_ENDPOINTS, defaultFetchOptions } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';

interface LoginPageProps {
  onDone?: () => void;
}

export default function WelcomeDirectionPage({ onDone }: LoginPageProps) {
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { checkAuth } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.users.createGuest, {
        ...defaultFetchOptions,
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create guest account');
      }

      const data = await response.json();
      console.log('Guest login successful', data);
      
      // Store token and user data in localStorage
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('token_type', data.token_type);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Update AuthContext immediately
      await checkAuth();
      
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create guest account');
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleAuthSuccess = (data: any) => {
    if (data.requireVerification) {
      // Hiển thị thông báo yêu cầu xác thực email
      setError(null);
      setAuthMode('login');
      // Hiển thị thông báo thành công
      const successMessage = data.message || "Registration successful. Please check your email to verify your account.";
      setError(successMessage);
      // Đổi màu thông báo thành xanh
      const errorElement = document.querySelector('.bg-red-500\\/20');
      if (errorElement) {
        errorElement.classList.remove('bg-red-500/20', 'border-red-500/30');
        errorElement.classList.add('bg-green-500/20', 'border-green-500/30');
      }
    } else {
      onDone?.();
    }
  };

  const handleAuthError = (error: string) => {
    setError(error);
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-slate-900 via-pink-900 to-black">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-pink-500/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-pink-500/8 to-rose-500/8 rounded-full blur-3xl animate-spin" style={{ animationDuration: '20s' }} />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(236,72,153,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(236,72,153,0.08)_1px,transparent_1px)] bg-[size:50px_50px] animate-pulse" />

      {/* Main container - Responsive layout */}
      <div className={`relative z-10 min-h-screen flex flex-col lg:flex-row transition-all duration-1000 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}>
        {/* Left section - Branding & Features (hide on mobile) */}
        <div className="flex-1 flex flex-col justify-center items-center p-4 lg:p-12 bg-gradient-to-br from-black/30 to-transparent backdrop-blur-sm hidden sm:flex">
          <div className="max-w-md text-center space-y-8">
            {/* Logo & Brand */}
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-500 to-rose-600 rounded-3xl shadow-2xl mb-6 transform hover:scale-110 transition-transform duration-300">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-5xl lg:text-6xl font-black bg-gradient-to-r from-pink-400 via-rose-400 to-pink-300 bg-clip-text text-transparent leading-tight">
                Kick'in
              </h1>
              <p className="text-xl text-white/80 font-light leading-relaxed">
                Tiny L1', Huge Kicks — Only at Kickin'.
              </p>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 py-8">
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-pink-400">10K+</div>
                <div className="text-sm text-white/60 font-medium">Active Players</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-rose-400">50+</div>
                <div className="text-sm text-white/60 font-medium">Games</div>
              </div>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-pink-300">24/7</div>
                <div className="text-sm text-white/60 font-medium">Support</div>
              </div>
            </div>
            {/* Features */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 bg-pink-500/20 rounded-lg flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-pink-400" />
                </div>
                <span className="font-medium">Global Leaderboards</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 bg-rose-500/20 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-rose-400" />
                </div>
                <span className="font-medium">Multiplayer Tournaments</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 bg-pink-400/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-pink-300" />
                </div>
                <span className="font-medium">Secure & Fair Play</span>
              </div>
            </div>
          </div>
        </div>
        {/* Right section - Login form (always visible, mobile-friendly) */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 shadow-2xl">
              {/* Form container */}
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Welcome Back!</h2>
                <p className="text-white/70">Join thousands of players worldwide</p>
              </div>
              {/* Error notification */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl backdrop-blur-sm">
                  <div className="flex items-start justify-between">
                    <p className="text-red-200 text-sm">{error}</p>
                    <button onClick={() => setError(null)} className="text-red-300 hover:text-red-100">
                      ×
                    </button>
                  </div>
                </div>
              )}
              {/* Mode selector */}
              <div className="flex bg-white/10 rounded-2xl p-1 mb-8 backdrop-blur-sm">
                <button
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-300 ${
                    authMode === 'login'
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg'
                      : 'text-white/70 hover:text-white'
                  }`}
                  onClick={() => setAuthMode('login')}
                >
                  Sign In
                </button>
                <button
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all duration-300 ${
                    authMode === 'register'
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg'
                      : 'text-white/70 hover:text-white'
                  }`}
                  onClick={() => setAuthMode('register')}
                >
                  Sign Up
                </button>
              </div>
              {/* Auth Form */}
              <AuthForm 
                mode={authMode as 'login' | 'register'} 
                onSuccess={handleAuthSuccess}
                onError={handleAuthError}
              />
              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-white/10 text-white/60 text-sm backdrop-blur-sm rounded-lg">
                    or continue as
                  </span>
                </div>
              </div>
              {/* Guest login */}
              <button
                onClick={handleGuestLogin}
                disabled={isGuestLoading}
                className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 relative overflow-hidden group ${
                  isGuestLoading
                    ? 'bg-white/10 text-white/50 cursor-not-allowed'
                    : 'bg-white/20 text-white hover:bg-pink-500/20 transform hover:-translate-y-1 shadow-lg hover:shadow-xl border border-pink-500/20 hover:border-pink-500/40'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {isGuestLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating guest account...
                    </>
                  ) : (
                    <>
                      <Users className="w-5 h-5" />
                      Continue as Guest
                    </>
                  )}
                </div>
              </button>
              {/* Terms */}
              <p className="text-center text-xs text-white/50 mt-6 leading-relaxed">
                By continuing, you agree to our{' '}
                <a href="#" className="text-pink-400 hover:text-pink-300 transition-colors">Terms of Service</a>
                {' '}and{' '}
                <a href="#" className="text-pink-400 hover:text-pink-300 transition-colors">Privacy Policy</a>
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Floating particles effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-pink-400/40 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>
    </div>
  );
}