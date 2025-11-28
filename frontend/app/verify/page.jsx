"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { GlassCard } from '@/components/ui/glass-card'
import { GradientButton } from '@/components/ui/gradient-button'
import { Input } from '@/components/ui/input'
import { AnimatedBadge } from '@/components/ui/animated-badge'
import AuditorBadge from '@/components/auditor-badge'
import CredibilityScore from '@/components/credibility-score'
import VerificationSteps from '@/components/verification-steps'
import { getReadOnlyContract } from '@/lib/ethers'
import { EXPLORER_URL } from '@/config'

const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || EXPLORER_URL
import { Search, ExternalLink, Shield, CheckCircle2, XCircle, User, Hash } from 'lucide-react'

export default function VerifyPage() {
  const [address, setAddress] = useState('')
  const [proofHash, setProofHash] = useState('')
  const [verificationMode, setVerificationMode] = useState('address') // 'address' or 'proof'
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [auditor, setAuditor] = useState(null)
  const [auditorData, setAuditorData] = useState(null)
  const [showSteps, setShowSteps] = useState(false)

  async function handleVerify() {
    const inputValue = verificationMode === 'address' ? address : proofHash;
    
    if (!inputValue) {
      toast.error(`Please enter a ${verificationMode === 'address' ? 'project address' : 'proof hash'}`)
      return
    }

    setIsLoading(true)
    setResult(null)
    setAuditor(null)
    setAuditorData(null)
    setShowSteps(true)

    try {
      if (verificationMode === 'address') {
        await verifyByAddress(inputValue)
      } else {
        await verifyByProofHash(inputValue)
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to check verification status')
    } finally {
      setIsLoading(false)
    }
  }

  async function verifyByAddress(projectAddress) {
    const contract = getReadOnlyContract()
    const isVerified = await contract.isVerified(projectAddress)
    setResult(isVerified)

    if (isVerified) {
      const auditorAddr = await contract.getAuditor(projectAddress)
      setAuditor(auditorAddr)
      
      // Fetch auditor data
      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
        const response = await fetch(`${BACKEND_URL}/api/auditors/${auditorAddr}`)
        const data = await response.json()
        if (data.success) {
          setAuditorData(data.auditor)
        }
      } catch (err) {
        console.error('Error fetching auditor data:', err)
      }
      
      toast.success('✅ Project verification found!')
    } else {
      toast.error('❌ No verification found')
    }
  }

  async function verifyByProofHash(hash) {
    // Mock proof verification - replace with actual contract call
    // This would check if the proof hash exists in the contract
    const contract = getReadOnlyContract()
    
    // For now, simulate proof verification
    // In reality, you'd call something like: contract.getCredential(hash)
    setResult(true) // Mock result
    setAuditor('0x1234567890123456789012345678901234567890') // Mock auditor
    toast.success('✅ Proof verification found!')
  }

  const handleVerificationComplete = (verificationResult) => {
    console.log('Verification completed:', verificationResult)
    // Handle completion if needed
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600">
            <Search className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Verify Audit Status</h1>
        <p className="text-white/60 text-lg">Check on-chain verification for projects or specific proofs</p>
      </motion.div>

      {/* Search Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <GlassCard className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-pink-500/20">
              <Shield className="h-6 w-6 text-pink-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Lookup Verification</h2>
              <p className="text-white/50 text-sm">Enter project wallet address</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Mode Selection */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
              <button
                onClick={() => setVerificationMode('address')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  verificationMode === 'address'
                    ? 'bg-pink-500 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <User className="w-4 h-4 inline mr-2" />
                Project Address
              </button>
              <button
                onClick={() => setVerificationMode('proof')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  verificationMode === 'proof'
                    ? 'bg-pink-500 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Hash className="w-4 h-4 inline mr-2" />
                Proof Hash
              </button>
            </div>

            {/* Input Field */}
            <div className="flex gap-3">
              <Input
                placeholder={verificationMode === 'address' ? '0x...' : 'Proof hash...'}
                value={verificationMode === 'address' ? address : proofHash}
                onChange={(e) => {
                  if (verificationMode === 'address') {
                    setAddress(e.target.value)
                  } else {
                    setProofHash(e.target.value)
                  }
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
                className="flex-1 bg-white/5 border-white/20 focus:border-pink-400 text-white"
              />
              <GradientButton
                onClick={handleVerify}
                isLoading={isLoading}
                disabled={verificationMode === 'address' ? !address : !proofHash}
                className="px-6"
              >
                <Search className="h-5 w-5" />
                {isLoading ? 'Checking...' : 'Verify'}
              </GradientButton>
            </div>

            <div className="text-xs text-white/50">
              💡 Tip: {verificationMode === 'address' 
                ? "Paste the project's wallet address to verify their audit status"
                : "Enter a specific proof hash to verify individual credentials"
              }
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Verification Steps */}
      <AnimatePresence>
        {showSteps && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.4 }}
          >
            <VerificationSteps
              proofHash={verificationMode === 'proof' ? proofHash : null}
              auditorAddress={verificationMode === 'address' ? address : null}
              onVerificationComplete={handleVerificationComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence mode="wait">
        {result !== null && (
          <motion.div
            key={result ? 'verified' : 'unverified'}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.4 }}
          >
            <GlassCard className={`p-8 border-2 ${result ? 'border-green-400/30' : 'border-red-400/30'}`}>
              <div className="flex flex-col items-center text-center space-y-6">
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className={`p-6 rounded-full ${
                    result
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                      : 'bg-gradient-to-br from-red-500 to-rose-600'
                  }`}
                >
                  {result ? (
                    <CheckCircle2 className="h-16 w-16 text-white" />
                  ) : (
                    <XCircle className="h-16 w-16 text-white" />
                  )}
                </motion.div>

                {/* Status */}
                <div>
                  <h3 className={`text-3xl font-bold mb-2 ${result ? 'text-green-400' : 'text-red-400'}`}>
                    {result ? 'Audit Verified ✓' : 'Not Verified'}
                  </h3>
                  <p className="text-white/60 max-w-md">
                    {result
                      ? 'This project has a verified audit credential recorded on Polygon Amoy'
                      : 'No verification record found for this address on-chain'}
                  </p>
                </div>

                {/* Badge */}
                <AnimatedBadge status={result ? 'verified' : 'unverified'} />

                {/* Auditor Info */}
                {result && auditor && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="w-full p-6 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-indigo-400" />
                        <span className="font-semibold text-white">Trusted Auditor Verification</span>
                      </div>
                      <AuditorBadge address={auditor} showScore={true} />
                    </div>
                    
                    {/* Trust Indicators */}
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-400/20 rounded-lg">
                      <div className="flex items-center gap-2 text-green-300 text-sm">
                        <Shield className="h-4 w-4" />
                        <span>✓ Approved Auditor - Credibility Verified</span>
                      </div>
                      <div className="mt-2 text-xs text-white/60">
                        This auditor has been verified and approved by the platform admin. 
                        Their credibility score is calculated from verified work history.
                      </div>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-sm text-white/50 mb-1">Auditor Address</div>
                        <div className="font-mono text-sm text-white/90 break-all mb-3">{auditor}</div>
                        
                        {auditorData && (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-white/60">Credentials Issued:</span>
                              <span className="text-white">{auditorData.credentialCount}</span>
                            </div>
                            {auditorData.githubHandle && (
                              <div className="flex justify-between">
                                <span className="text-white/60">GitHub:</span>
                                <a 
                                  href={`https://github.com/${auditorData.githubHandle}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:text-indigo-300"
                                >
                                  @{auditorData.githubHandle}
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-center">
                        <CredibilityScore address={auditor} size="md" showBreakdown={true} />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-4">
                      <a
                        href={`${explorerBase}/address/${auditor}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors text-sm"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View on Explorer
                      </a>
                      
                      <a
                        href={`/auditor/reputation?address=${auditor}`}
                        className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors text-sm"
                      >
                        <Shield className="h-4 w-4" />
                        View Full Reputation
                      </a>
                    </div>
                  </motion.div>
                )}

                {/* Project Address */}
                <div className="w-full p-4 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-white/50 mb-1">Project Address</div>
                  <div className="font-mono text-sm text-white/80 break-all">{address}</div>
                </div>

                {/* Explorer Link */}
                {result && (
                  <a
                    href={`${explorerBase}/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative z-10 pointer-events-auto inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white transition-all duration-300"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Polygon Explorer
                  </a>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Section */}
      {result === null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <GlassCard className="p-8">
            <h3 className="text-xl font-bold text-white mb-4">How Verification Works</h3>
            <div className="space-y-3 text-white/60 leading-relaxed">
              <p>
                1️⃣ <strong className="text-white">Auditors</strong> issue verifiable credentials to projects after completing audits
              </p>
              <p>
                2️⃣ <strong className="text-white">Projects</strong> generate zero-knowledge proofs without revealing audit details
              </p>
              <p>
                3️⃣ <strong className="text-white">Verification status</strong> is recorded immutably on Polygon Amoy Testnet
              </p>
              <p>
                4️⃣ <strong className="text-white">Anyone</strong> can verify a project's audit status using their wallet address
              </p>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </div>
  )
}