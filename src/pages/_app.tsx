import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext';
import { UploadModalProvider } from '../contexts/UploadModalContext';
import Layout from '../components/Layout';
import '../styles/globals.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '../lib/queryClient';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UploadModalProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </UploadModalProvider>
      </AuthProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}