import { useEffect } from 'react';
import { useRouter } from 'next/router';
import LoginPage from './LoginPage';

export default function LoginRoute() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('access_token', token);
      router.push('/');
    }
  }, []);

  const handleDone = () => {
    router.push('/');
  };

  return <LoginPage onDone={handleDone} />;
} 