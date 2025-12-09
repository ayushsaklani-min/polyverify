"use client"

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import confetti from 'canvas-confetti'
import { GlassCard } from '@/components/ui/glass-card'
import { GradientButton } from '@/components/ui/gradient-button'
import { AnimatedBadge } from '@/components/ui/animated-badge'

const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet-scan.polygon.technology'
import { generateProof } from '@/lib/airkit'
import { Lock, Send, CheckCircle, FileKey, Sparkles } from 'lucide-react'

export default function ProjectPage() {
  const { address } = useAccount()
  const [credential, setCredential] = useState(null)
  const [proof, setProof] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [verified, setVerified] = useState(false)
  const [txResult, setTxResult] = useState(null)

  useEffect(() => {
    const cached = localStorage.getItem('polverify:lastCredential')
    if (cached) setCredential(JSON.parse(cached))
  }, [])

  async function handleGenerateProof() {
    if (!credential) {
      toast.error('No credential found. Request one from your auditor.')
      return
    }

    setIsGenerating(true)
    try {
      // Try backend first (supports fallback when AIR3 is offline)
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
      const r = await fetch(`${BACKEND_URL}/api/proofs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId: credential.credential_id || credential.id })
      })
      let p
      if (r.ok) {
        const data = await r.json()
        p = {
          proofId: data.proof_id,
          credentialId: credential.credential_id || credential.id,
          credentialOnChainId: data.on_chain_id || null,
          on_chain_id: data.on_chain_id || null,
          credential,
          valid: data.valid !== false,
          generatedAt: Date.now(),
          proofData: data.proof_data || {},
          stats: data.stats || null
        }
      } else {
        // fallback to direct AIR3 call (may fail if AIR3 unreachable)
        p = await generateProof(credential)
      }
      setProof(p)
      toast.success('🔐 Zero-knowledge proof generated!')
    } catch (e) {
      console.error(e)
      toast.error('❌ Proof generation failed')
    } finally {
      setIsGenerating(false)
    }
  }

  async function handleSubmitProof() {
    if (!proof) {
      toast.error('Generate a proof first')
      return
    }
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    setIsSubmitting(true)
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
      
      // Use the correct endpoint: /api/proofs/verify with proofId
      const res = await fetch(`${BACKEND_URL}/api/proofs/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofId: proof.proofId })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || data?.details || 'Backend verification failed')
      }

      const data = await res.json()
      if (!data.success) {
        throw new Error(data?.error || data?.details || 'Proof verification failed')
      }

      setVerified(true)
      setTxResult({ txHash: data.txnHash, gasUsed: data.gasUsed })
      toast.success('🎉 Verification recorded on-chain!')

      // Trigger confetti
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#ec4899']
      })
    } catch (e) {
      console.error(e)
      toast.error(`❌ ${e.message}`)
      setVerified(false)
      setTxResult(null)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
            <Lock className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Project Dashboard</h1>
        <p className="text-white/60 text-lg">Generate zero-knowledge proofs and verify on-chain</p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Generate Proof Card */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <GlassCard className="p-8 h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <FileKey className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Generate ZK Proof</h2>
                <p className="text-white/50 text-sm">Create proof from your credential</p>
              </div>
            </div>

            {credential ? (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-gradient-to-br from-purple-500/15 to-pink-500/15 border border-white/20 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-medium text-purple-400">Using Credential</span>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white/50 mb-1">Credential ID</div>
                    <div className="font-mono text-sm text-white/90 break-all">{credential.id}</div>
                  </div>
                  {credential.onChainId && (
                    <div>
                      <div className="text-xs font-medium text-white/50 mb-1">On-chain ID</div>
                      <div className="font-mono text-xs text-white/80 break-all">{credential.onChainId}</div>
                    </div>
                  )}
                  <div className="h-px bg-white/10" />
                  <div>
                    <div className="text-xs font-medium text-white/50 mb-1">Status</div>
                    <div className="text-sm text-green-300">{credential.status}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white/50 mb-1">Issued</div>
                    <div className="text-sm text-white/70">{new Date(credential.issuedAt).toLocaleDateString()}</div>
                  </div>
                </div>

                {proof ? (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-6 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-400/20"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                      <span className="font-semibold text-green-400">Proof Generated</span>
                    </div>
                    <div className="text-xs font-medium text-white/50 mb-1">Proof ID</div>
                    <div className="font-mono text-xs text-white/80 break-all mb-2">{proof.proofId}</div>
                    {proof.credentialOnChainId && (
                      <div className="text-xs text-white/50">
                        On-chain Credential:&nbsp;
                        <span className="font-mono text-white/80 break-all">{proof.credentialOnChainId}</span>
                      </div>
                    )}
                    {proof.stats && (
                      <div className="mt-3 text-xs text-white/50 space-y-1">
                        <div>Generation Time: {proof.stats.duration_ms} ms</div>
                        <div>Proof Size: {proof.stats.proof_size_bytes} bytes</div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <GradientButton
                    onClick={handleGenerateProof}
                    isLoading={isGenerating}
                    disabled={!credential}
                    className="w-full"
                  >
                    {isGenerating ? 'Generating Proof...' : 'Generate ZK Proof'}
                  </GradientButton>
                )}

                <div className="text-xs text-white/50 leading-relaxed">
                  ℹ️ The proof proves you have a valid credential without revealing the actual audit report contents.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="p-4 rounded-full bg-white/5 mb-4">
                  <FileKey className="h-12 w-12 text-white/30" />
                </div>
                <p className="text-white/50 max-w-xs mb-4">
                  No credential found in storage
                </p>
                <p className="text-xs text-white/40 max-w-xs">
                  Request an audit credential from an auditor to get started
                </p>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Submit Proof Card */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <GlassCard className="p-8 h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-pink-500/20">
                <Send className="h-6 w-6 text-pink-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Submit Proof</h2>
                <p className="text-white/50 text-sm">Record verification on Polygon Amoy</p>
              </div>
            </div>

            {verified ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="flex flex-col items-center justify-center h-64 text-center"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    repeatDelay: 2
                  }}
                  className="p-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 mb-6"
                >
                  <CheckCircle className="h-16 w-16 text-white" />
                </motion.div>
                <h3 className="text-2xl font-bold text-green-400 mb-2">Verification Successful!</h3>
                <p className="text-white/60 max-w-xs">
                  Your audit status has been recorded on Polygon Amoy Testnet
                </p>
                <AnimatedBadge status="verified" className="mt-6" />
                {txResult && (
                  <div className="mt-4 text-xs text-white/50 space-y-1">
                    {txResult.txHash && (
                      <div>
                        Tx Hash:{' '}
                        <a
                          href={`${explorerUrl}/tx/${txResult.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-300 hover:text-indigo-200"
                        >
                          {txResult.txHash.slice(0, 10)}...{txResult.txHash.slice(-6)}
                        </a>
                      </div>
                    )}
                    {txResult.gasUsed && (
                      <div>Gas Used: {txResult.gasUsed}</div>
                    )}
                  </div>
                )}
              </motion.div>
            ) : proof ? (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-white/10">
                  <div className="text-xs font-medium text-white/50 mb-1">Ready to Submit</div>
                  <div className="font-mono text-sm text-white/90 break-all mb-4">{proof.proofId}</div>
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Lock className="h-3 w-3" />
                    <span>Zero-knowledge proof verified locally</span>
                  </div>
                </div>

                <GradientButton
                  onClick={handleSubmitProof}
                  isLoading={isSubmitting}
                  disabled={!address}
                  className="w-full"
                >
                  {isSubmitting ? 'Submitting Proof...' : 'Submit to Blockchain'}
                </GradientButton>

                <div className="text-xs text-white/50 leading-relaxed">
                  ✅ Submitting will record your verified status on-chain, visible to all investors and users.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="p-4 rounded-full bg-white/5 mb-4">
                  <Send className="h-12 w-12 text-white/30" />
                </div>
                <p className="text-white/50 max-w-xs">
                  Generate a proof first to submit for on-chain verification
                </p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  )
}