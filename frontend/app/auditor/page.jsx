"use client"

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { GlassCard } from '@/components/ui/glass-card'
import { GradientButton } from '@/components/ui/gradient-button'
import { Input } from '@/components/ui/input'
import { AnimatedBadge } from '@/components/ui/animated-badge'
import AuditorBadge from '@/components/auditor-badge'
import CredibilityScore from '@/components/credibility-score'
import { issueCredential } from '@/lib/airkit'
import { getContractWithSigner, getSigner } from '@/lib/ethers'
import { keccak256Utf8, uuidToBytes32 } from '@/lib/hash'
import { ethers } from 'ethers'
import { FileSignature, Anchor, CheckCircle2, AlertCircle, ExternalLink, Shield } from 'lucide-react'

export default function AuditorPage() {
  const { address } = useAccount()
  const [project, setProject] = useState("")
  const [title, setTitle] = useState("")
  const [summary, setSummary] = useState("")
  const [status, setStatus] = useState("Verified - No Critical Issues")
  const [isIssuing, setIsIssuing] = useState(false)
  const [isAnchoring, setIsAnchoring] = useState(false)
  const [credential, setCredential] = useState(null)
  const [isAnchored, setIsAnchored] = useState(false)
  const [isApproved, setIsApproved] = useState(false)
  const [checkingApproval, setCheckingApproval] = useState(true)

  useEffect(() => {
    const cached = localStorage.getItem('zkverify:lastCredential')
    if (cached) setCredential(JSON.parse(cached))
  }, [])

  useEffect(() => {
    const checkAuditorApproval = async () => {
      if (!address) {
        setCheckingApproval(false)
        return
      }

      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
        // Check approval status
        const approvalResponse = await fetch(`${BACKEND_URL}/api/auditors/${address}/is-approved`)
        const approvalData = await approvalResponse.json()
        
        if (approvalData.success) {
          setIsApproved(approvalData.isApproved)
          
          // If approved, also fetch full auditor data to show credibility
          if (approvalData.isApproved) {
            const auditorResponse = await fetch(`${BACKEND_URL}/api/auditors/${address}`)
            const auditorData = await auditorResponse.json()
            // Store for display if needed
          }
        }
      } catch (error) {
        console.error('Error checking auditor approval:', error)
      } finally {
        setCheckingApproval(false)
      }
    }

    checkAuditorApproval()
  }, [address])

  async function handleIssueCredential() {
    if (!address) {
      toast.error('Please connect your wallet as auditor')
      return
    }
    if (!isApproved) {
      toast.error('Only approved auditors can issue credentials')
      return
    }
    if (!project) {
      toast.error('Please enter project address')
      return
    }
    if (!summary) {
      toast.error('Please enter audit summary')
      return
    }

    console.log('[Auditor] Issue clicked', { project, title, summary, status })
    setIsIssuing(true)
    try {
      const summaryHash = keccak256Utf8(`${title}|${summary}`)
      const signer = await getSigner()
      const issuerSignature = await signer.signMessage(ethers.getBytes(summaryHash))
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'
      // Prefer server-issued credential to avoid CORS and secret exposure
      const endpoint = `${BACKEND_URL}/api/issueCredential`
      console.log('[Auditor] POST', endpoint)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issuer: address, subject: project, summaryHash, status, issuerSignature })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        console.error('[Auditor] Issue error response', data)
        throw new Error(data?.error || `Issue failed (${res.status})`)
      }
      const data = await res.json()
      console.log('[Auditor] Issue success', data)
      const cred = {
        ...data,
        id: data.credential_id || data.id,
        onChainId: data.on_chain_id || null,
        issuer: address,
        subject: project,
        summaryHash,
        status,
        issuedAt: data.issued_at || new Date().toISOString(),
        serverSignature: data.server_signature || null
      }
      setCredential(cred)
      setIsAnchored(false)
      localStorage.setItem('zkverify:lastCredential', JSON.stringify(cred))
      toast.success('✅ Credential issued successfully!')
    } catch (e) {
      console.error('[Auditor] Issue failed', e)
      toast.error(`❌ Failed to issue credential: ${e.message}`)
    } finally {
      setIsIssuing(false)
    }
  }

  async function handleAnchorOnChain() {
    if (!credential) {
      toast.error('Please issue a credential first')
      return
    }
    if (!address) {
      toast.error('Please connect your wallet')
      return
    }

    setIsAnchoring(true)
    try {
      const contract = await getContractWithSigner()
      const signer = await getSigner()
      const idBytes32 = credential.onChainId || uuidToBytes32(credential.id)
      
      // Create message hash for signing: keccak256(abi.encodePacked(id, subject, summaryHash))
      // This must match the contract's verification logic exactly
      const messageHash = ethers.keccak256(
        ethers.solidityPacked(['bytes32', 'address', 'bytes32'], [
          idBytes32,
          credential.subject || project,
          credential.summaryHash
        ])
      )
      
      // Sign the message hash with Ethereum message prefix (\x19Ethereum Signed Message:\n32)
      // The signMessage() function automatically adds this prefix
      const signature = await signer.signMessage(ethers.getBytes(messageHash))
      
      // Use issueCredential with signature instead of anchorCredential
      const tx = await contract.issueCredential(
        idBytes32,
        credential.subject,
        credential.summaryHash,
        signature
      )
      await tx.wait()
      setIsAnchored(true)
      toast.success('🎉 Credential anchored on Polygon Amoy!')
    } catch (e) {
      console.error(e)
      toast.error(`❌ Failed to anchor credential: ${e.message}`)
    } finally {
      setIsAnchoring(false)
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
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <FileSignature className="h-8 w-8 text-white" />
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mb-4">
          <h1 className="text-4xl md:text-5xl font-bold text-white">Auditor Dashboard</h1>
          {address && <AuditorBadge address={address} showScore={true} size="lg" />}
        </div>
        <p className="text-white/60 text-lg">Issue verifiable audit credentials and anchor them on-chain</p>
        
        {address && (
          <div className="flex items-center justify-center gap-6 mt-6">
            <CredibilityScore address={address} size="md" showBreakdown={true} />
            <a
              href={`/auditor/reputation?address=${address}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white text-sm"
            >
              View Full Reputation
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </motion.div>

      {/* Approval Status with Trust Indicators */}
      {address && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <GlassCard className={`p-6 ${isApproved ? 'border-2 border-green-400/30' : ''}`}>
            {checkingApproval ? (
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span className="text-white">Checking auditor approval status...</span>
              </div>
            ) : isApproved ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                    <div>
                      <h3 className="text-white font-semibold">Verified Trusted Auditor</h3>
                      <p className="text-white/60 text-sm">Your credibility has been verified and you can issue credentials</p>
                    </div>
                  </div>
                  <AuditorBadge address={address} showScore={true} />
                </div>
                
                {/* Trust Verification Details */}
                <div className="p-4 bg-green-500/10 border border-green-400/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-green-400" />
                    <span className="text-sm font-medium text-green-300">Trust Verification Complete</span>
                  </div>
                  <div className="text-xs text-white/70 space-y-1">
                    <div>✓ Admin-approved auditor status verified</div>
                    <div>✓ Credibility score calculated from verified work history</div>
                    <div>✓ Credibility credential issued upon approval</div>
                    <div>✓ External platform activity verified (GitHub, Code4rena, Immunefi)</div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <a
                    href={`/auditor/reputation?address=${address}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Full Credibility Report
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-6 w-6 text-yellow-400" />
                  <div>
                    <h3 className="text-white font-semibold">Approval Required</h3>
                    <p className="text-white/60 text-sm">
                      You need to be approved by an admin to issue credentials.
                    </p>
                  </div>
                </div>
                
                {/* Onboarding Information */}
                <div className="p-4 bg-yellow-500/10 border border-yellow-400/20 rounded-lg">
                  <h4 className="text-sm font-medium text-yellow-300 mb-2">How to Get Approved:</h4>
                  <div className="text-xs text-white/70 space-y-1">
                    <div>1. Contact the platform administrator</div>
                    <div>2. Provide your GitHub, Code4rena, and Immunefi handles</div>
                    <div>3. Admin will verify your work history and issue a credibility credential</div>
                    <div>4. Once approved, you'll be able to issue audit credentials</div>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Issue Credential Card */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <GlassCard className="p-8 h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-indigo-500/20">
                <FileSignature className="h-6 w-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Issue Credential</h2>
                <p className="text-white/50 text-sm">Create an audit credential via AIR Kit</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Project Address
                </label>
                <Input
                  placeholder="0x..."
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="bg-white/5 border-white/20 focus:border-indigo-400 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Audit Title
                </label>
                <Input
                  placeholder="Security Audit Q4 2024"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-white/5 border-white/20 focus:border-indigo-400 text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Audit Summary
                </label>
                <textarea
                  placeholder="Brief summary of audit findings..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/20 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 text-white placeholder-white/50 transition-all duration-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/70 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-[#0b0f19]/90 text-white border border-white/20 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition-all duration-300"
                >
                  <option value="Verified - No Critical Issues">Verified - No Critical Issues</option>
                  <option value="Verified - Minor Issues">Verified - Minor Issues</option>
                  <option value="Verified - Major Issues Fixed">Verified - Major Issues Fixed</option>
                  <option value="Pending Review">Pending Review</option>
                </select>
              </div>

              <GradientButton
                onClick={handleIssueCredential}
                isLoading={isIssuing}
                disabled={!address || !isApproved}
                className="w-full"
              >
                {isIssuing ? 'Issuing Credential...' : 'Issue Credential'}
              </GradientButton>

              {!address && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm p-3 bg-yellow-500/10 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <span>Connect wallet to continue</span>
                </div>
              )}

              {address && !isApproved && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-400 text-sm p-3 bg-red-500/10 rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    <span>Only verified trusted auditors can issue credentials</span>
                  </div>
                  <div className="text-xs text-white/60 p-3 bg-white/5 rounded-lg">
                    <div className="font-medium mb-1">Trust Requirements:</div>
                    <div>• Admin approval with credibility verification</div>
                    <div>• Verified work history from GitHub, Code4rena, or Immunefi</div>
                    <div>• Credibility credential issued upon approval</div>
                  </div>
                </div>
              )}

              {address && isApproved && (
                <div className="flex items-center gap-2 text-green-400 text-sm p-3 bg-green-500/10 rounded-lg border border-green-400/20">
                  <Shield className="h-4 w-4" />
                  <span>✓ Your auditor status is verified and trusted</span>
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Anchor On-Chain Card */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <GlassCard className="p-8 h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Anchor className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Anchor On-Chain</h2>
                <p className="text-white/50 text-sm">Write credential to Polygon Amoy</p>
              </div>
            </div>

            {credential ? (
              <div className="space-y-6">
                <div className="p-6 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 space-y-4">
                  <div>
                    <div className="text-xs font-medium text-white/50 mb-1">Credential ID</div>
                    <div className="font-mono text-sm text-white/90 break-all">{credential.id}</div>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div>
                    <div className="text-xs font-medium text-white/50 mb-1">Summary Hash</div>
                    <div className="font-mono text-sm text-white/90 break-all">{credential.summaryHash}</div>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div>
                    <div className="text-xs font-medium text-white/50 mb-1">Issued At</div>
                    <div className="text-sm text-white/90">{new Date(credential.issuedAt).toLocaleString()}</div>
                  </div>
                </div>

                {isAnchored ? (
                  <AnimatedBadge status="verified" className="w-full justify-center" />
                ) : (
                  <GradientButton
                    onClick={handleAnchorOnChain}
                    isLoading={isAnchoring}
                    disabled={!address}
                    className="w-full"
                  >
                    {isAnchoring ? 'Anchoring...' : 'Anchor to Polygon Amoy'}
                  </GradientButton>
                )}

                {!isAnchored && (
                  <div className="flex items-start gap-2 text-green-400/80 text-sm">
                    <CheckCircle2 className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <p className="leading-relaxed">
                      Ready to anchor. Only hashed summary and credential ID will be stored on-chain, 
                      preserving privacy of full audit report.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="p-4 rounded-full bg-white/5 mb-4">
                  <Anchor className="h-12 w-12 text-white/30" />
                </div>
                <p className="text-white/50 max-w-xs">
                  Issue a credential first to see details and anchor it on-chain
                </p>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  )
}