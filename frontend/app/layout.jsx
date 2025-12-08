import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { WalletProvider } from '@/providers/wallet'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from '@/components/error-boundary'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata = {
  title: 'Polverify - Verifiable Smart Contract Audit Credentials',
  description: 'Prove your smart contracts have been audited without revealing private audit reports using zero-knowledge proofs.',
  keywords: 'blockchain, audit, verification, zk, credentials, smart contracts, polygon amoy',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans`}>
        <ErrorBoundary>
          <WalletProvider>
            <div className="relative min-h-screen overflow-x-hidden">
              {/* Animated Background Gradients */}
              <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
              </div>

              {/* Main Content */}
              <Navbar />
              <main className="relative">
                {children}
              </main>
              <Footer />
            </div>
          </WalletProvider>
        </ErrorBoundary>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: '',
            style: {
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#f9fafb',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              backdropFilter: 'blur(12px)',
              borderRadius: '12px',
              padding: '16px 20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              fontSize: '14px',
              fontWeight: '500',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </body>
    </html>
  )
}