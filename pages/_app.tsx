import type { AppProps } from 'next/app';
import { RootProvider } from '@/components/RootProvider';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <RootProvider>
      <Component {...pageProps} />
    </RootProvider>
  );
}

