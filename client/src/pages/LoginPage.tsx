import { usePrivy } from '@privy-io/react-auth';
import Image from 'next/image';
import welcomeBg from '@/photo/WelcomeBackGround.jpg';
import { API_ENDPOINTS } from '@/config/api';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef, useState } from 'react';

interface WelcomeDirectionPageProps {
  onDone: () => void;
}

export default function WelcomeDirectionPage({ onDone }: WelcomeDirectionPageProps) {
  const { login, user: privyUser, ready } = usePrivy();
  const router = useRouter();
  const { checkAuth } = useAuth();
  const hasHandled = useRef(false);
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [isPrivyLoading, setIsPrivyLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null);

  const handlePrivyAuth = async (mode: 'login' | 'register') => {
    if (isPrivyLoading) return;
    
    setIsPrivyLoading(true);
    setAuthMode(mode);
    
    try {
      console.log(`Starting Privy ${mode}...`);
      await login();
    } catch (error) {
      console.error(`${mode} error:`, error);
      alert(`${mode === 'login' ? 'Login' : 'Registration'} failed: ` + (error instanceof Error ? error.message : 'Unknown error'));
      setIsPrivyLoading(false);
      setAuthMode(null);
    }
  };

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.users.createGuest, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create guest user');
      }
      const data = await response.json();
      if (!data || !data.access_token) {
        throw new Error('Invalid guest user data received from server');
      }
      console.log('Guest login successful, saving token...');
      localStorage.setItem('access_token', data.access_token);
      console.log('Guest token saved to localStorage');
      
      setTimeout(async () => {
        await checkAuth();
        const returnUrl = router.query.returnUrl as string;
        if (returnUrl) {
          router.push(returnUrl);
        } else {
          onDone();
        }
      }, 200);
    } catch (error) {
      console.error('Guest login error:', error);
      alert('Guest login failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleAuthSuccess = async (userData: any) => {
    if (!userData || !userData.access_token) {
      throw new Error('Invalid user data received from server');
    }

    console.log('Auth successful, saving token...');
    localStorage.setItem('access_token', userData.access_token);
    
    setTimeout(async () => {
      await checkAuth();
      const returnUrl = router.query.returnUrl as string;
      if (returnUrl) {
        router.push(returnUrl);
      } else {
        onDone();
      }
    }, 200);
  };

  useEffect(() => {
    if (ready && privyUser?.id && !hasHandled.current && authMode) {
      hasHandled.current = true;
      
      const requestData = {
        privy_id: privyUser.id,
        email: privyUser.email?.address || null,
        wallet: privyUser.wallet?.address || null,
        name: privyUser.email?.address?.split('@')[0] || 'Player',
        avatar: privyUser.email?.address ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${privyUser.email.address}` : undefined
      };

      const endpoint = authMode === 'login' 
        ? API_ENDPOINTS.users.authWithPrivyLogin 
        : API_ENDPOINTS.users.authWithPrivyRegister;

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestData)
      })
      .then(async response => {
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `Failed to ${authMode} with server`);
        }
        return response.json();
      })
      .then(userData => handleAuthSuccess(userData))
      .catch(error => {
        console.error(`${authMode} error:`, error);
        alert(`${authMode === 'login' ? 'Login' : 'Registration'} failed: ` + (error instanceof Error ? error.message : 'Unknown error'));
      })
      .finally(() => {
        setIsPrivyLoading(false);
        setAuthMode(null);
      });
    }
    if (!privyUser) {
      hasHandled.current = false;
    }
  }, [privyUser, ready, authMode]);

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative"
      style={{
        backgroundImage: `url(${welcomeBg.src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#111',
        width: '100vw',
        height: '100vh',
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 z-10" />
      {/* Welcome box */}
      <div className="relative z-20 flex flex-col items-center justify-center w-full">
        <div className="backdrop-blur-md bg-white/70 rounded-2xl shadow-2xl px-10 py-16 max-w-md w-full text-center mx-auto" style={{maxWidth: 420}}>
          <h2 className="text-3xl font-extrabold mb-4 text-slate-900 drop-shadow">Welcome to Kick'in!</h2>
          <p className="mb-8 text-base text-slate-700">Sign up or log in to start playing and saving your progress.</p>
          
          <div className="space-y-4">
            <button
              className={`w-full py-3 bg-primary text-white rounded-lg font-bold text-lg shadow hover:bg-primary/90 transition ${isPrivyLoading && authMode === 'login' ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handlePrivyAuth('login')}
              disabled={isPrivyLoading && authMode === 'login'}
            >
              {isPrivyLoading && authMode === 'login' ? 'Logging in...' : 'Log In'}
            </button>

            <button
              className={`w-full py-3 bg-secondary text-white rounded-lg font-bold text-lg shadow hover:bg-secondary/90 transition ${isPrivyLoading && authMode === 'register' ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => handlePrivyAuth('register')}
              disabled={isPrivyLoading && authMode === 'register'}
            >
              {isPrivyLoading && authMode === 'register' ? 'Signing up...' : 'Sign Up'}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white/70 text-gray-500">or</span>
              </div>
            </div>

            <button
              className={`w-full py-3 rounded-lg font-bold text-lg shadow transition ${isGuestLoading ? 'bg-slate-300 text-slate-400 cursor-not-allowed' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
              onClick={handleGuestLogin}
              disabled={isGuestLoading}
            >
              {isGuestLoading ? 'Đang vào với tư cách khách...' : 'Try as Guest'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 