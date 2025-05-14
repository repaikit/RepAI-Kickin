import { PrivyProvider as BasePrivyProvider } from '@privy-io/react-auth';

export const PrivyProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <BasePrivyProvider
      appId="cmankoxe6005kky0m7conxm53"
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#4F46E5',
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}; 