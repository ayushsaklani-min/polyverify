'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi'
import { Wallet, Power, AlertCircle } from 'lucide-react'

export function ConnectButton() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  // Avoid SSR/CSR markup mismatches
  if (!mounted) {
    return (
      <button
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 opacity-80"
        aria-hidden
      >
        <Wallet className="w-5 h-5" />
        Connect Wallet
      </button>
    )
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {/* Wrong Network Warning */}
        {chainId !== 80002 && (
          <button
            onClick={() => switchChain({ chainId: 80002 })}
            disabled={isSwitching}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 border border-yellow-400/30 text-yellow-300 hover:bg-yellow-500/30 transition-all duration-300 disabled:opacity-50 text-sm font-medium"
          >
            <AlertCircle className="w-4 h-4" />
            <span>{isSwitching ? 'Switching...' : 'Switch to Polygon'}</span>
          </button>
        )}

        {/* Address Display */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-white/20 backdrop-blur-sm">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-mono text-white">
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </div>

        {/* Disconnect Button */}
        <button
          onClick={() => disconnect()}
          className="p-2 rounded-lg bg-white/10 hover:bg-red-500/20 border border-white/20 hover:border-red-400/30 text-white/70 hover:text-red-400 transition-all duration-300"
          title="Disconnect"
        >
          <Power className="w-4 h-4" />
        </button>
      </div>
    )
  }

  const injected = connectors.find((c) => c.id === 'injected') || connectors[0]

  return (
    <button
      onClick={() => connect({ connector: injected })}
      disabled={isPending}
      className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Wallet className="w-5 h-5" />
      {isPending ? 'Connecting...' : 'Connect Wallet'}
    </button>
  )
}