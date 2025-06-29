import { useEffect } from 'react';
import { useRouter } from 'next/router';
import LoginPage from './LoginPage';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginRoute() {
  const router = useRouter();
  const { checkAuth } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('access_token', token);
      const refreshToken = params.get('refresh_token');
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
      checkAuth().then(() => {
        router.push('/');
      });
    }
  }, [router, checkAuth]);

  const handleDone = () => {
    router.push('/');
  };

  return <LoginPage onDone={handleDone} />;
} 