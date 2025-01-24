import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext';
import { UploadModalProvider } from '../contexts/UploadModalContext';
import Layout from '../components/Layout';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <UploadModalProvider>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </UploadModalProvider>
    </AuthProvider>
  );
}