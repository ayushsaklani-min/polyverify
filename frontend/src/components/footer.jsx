'use client'

import { Shield, Github, Twitter, Globe } from 'lucide-react'
import Link from 'next/link'

const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet-scan.polygon.technology'

export function Footer() {
  return (
    <footer className="relative mt-20 border-t border-white/10 bg-black/20 backdrop-blur-xl">
      <div className="container max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                zkVerify
              </span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Verifiable smart contract audit credentials using zero-knowledge proofs on Polygon Amoy.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <div className="space-y-2">
              {[
                { name: 'Home', href: '/' },
                { name: 'Auditor', href: '/auditor' },
                { name: 'Project', href: '/project' },
                { name: 'Verify', href: '/verify' },
              ].map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="block text-gray-400 hover:text-white transition-colors"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Network Info */}
          <div>
            <h3 className="text-white font-semibold mb-4">Network</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Globe className="w-4 h-4" />
                <span>Polygon Amoy Testnet</span>
              </div>
              <div className="text-gray-400">Chain ID: 80002</div>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300 transition-colors inline-flex items-center gap-1"
              >
                Block Explorer ↗
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-gray-500 text-sm">
            © 2024 zkVerify. Built for Polygon Amoy Testnet.
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}