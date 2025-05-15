import { useRouter } from 'next/router';
import LoginPage from './LoginPage';

export default function LoginRoute() {
  const router = useRouter();

  const handleDone = () => {
    router.push('/');
  };

  return <LoginPage onDone={handleDone} />;
} 