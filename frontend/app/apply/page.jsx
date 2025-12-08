'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { GlassCard } from '@/components/ui/glass-card';
import { GradientButton } from '@/components/ui/gradient-button';
import { Input } from '@/components/ui/input';
import { FileText, Github, Shield, Bug, Wallet, Send, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useAccount } from 'wagmi';

export default function ApplyPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    walletAddress: '',
    githubHandle: '',
    code4renaHandle: '',
    immunefiHandle: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Prevent hydration mismatch by only rendering client-side
  useEffect(() => {
    setMounted(true);
    if (address) {
      setFormData(prev => ({ ...prev, walletAddress: address }));
    }
  }, [address]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.walletAddress || formData.walletAddress.length !== 42 || !formData.walletAddress.startsWith('0x')) {
      toast.error('Please enter a valid wallet address (0x...)');
      return;
    }

    if (!formData.githubHandle && !formData.code4renaHandle && !formData.immunefiHandle) {
      toast.error('Please provide at least one platform handle (GitHub, Code4rena, or Immunefi)');
      return;
    }

    setLoading(true);
    
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
      const response = await fetch(`${BACKEND_URL}/api/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSubmitted(true);
        setApplicationStatus('pending');
        toast.success('Application submitted successfully!');
      } else {
        // Provide better error messages
        const errorMsg = data.error || 'Failed to submit application';
        if (data.alreadyApproved || errorMsg.includes('already approved')) {
          toast.success('You are already an approved auditor! Redirecting to dashboard...', { duration: 3000 });
          setTimeout(() => {
            window.location.href = '/auditor';
          }, 2000);
          return;
        } else if (errorMsg.includes('already pending')) {
          toast.error('You already have a pending application. Please wait for review.', { duration: 5000 });
        } else {
          toast.error(errorMsg, { duration: 5000 });
        }
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Application error:', error);
      toast.error(error.message || 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-fill wallet address if connected (only on client)
  useEffect(() => {
    if (mounted && isConnected && address) {
      setFormData(prev => ({ ...prev, walletAddress: address }));
      checkApplicationStatus(address);
    }
  }, [mounted, isConnected, address]);

  // Check application status
  const checkApplicationStatus = async (walletAddr) => {
    if (!walletAddr) return;
    
    setCheckingStatus(true);
    try {
      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
      const response = await fetch(`${BACKEND_URL}/api/apply/${walletAddr}`);
      const data = await response.json();
      
      if (data.success && data.hasApplication) {
        setApplicationStatus(data.status);
      } else {
        setApplicationStatus(null);
      }
    } catch (error) {
      console.error('Error checking status:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-12 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Application Submitted!</h2>
              <p className="text-white/70 text-lg mb-6">
                Thank you for applying to become a verified auditor on Polverify.
              </p>
              <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-lg p-6 mb-6 text-left">
                <h3 className="text-white font-semibold mb-3">What happens next?</h3>
                <ul className="space-y-2 text-white/70 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-1">✓</span>
                    <span>Our admin will review your application and verify your work history</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-1">✓</span>
                    <span>We'll check your GitHub repositories, Code4rena findings, and Immunefi submissions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-1">✓</span>
                    <span>Your credibility score will be calculated based on verified contributions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-1">✓</span>
                    <span>You'll receive notification once approved (usually within 24-48 hours)</span>
                  </li>
                </ul>
              </div>
              <div className="flex gap-4 justify-center">
                <GradientButton
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({
                      walletAddress: address || '',
                      githubHandle: '',
                      code4renaHandle: '',
                      immunefiHandle: '',
                      message: ''
                    });
                  }}
                >
                  Submit Another Application
                </GradientButton>
                <button
                  onClick={() => router.push('/')}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
                >
                  Back to Home
                </button>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <FileText className="h-8 w-8 text-white" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Apply as Auditor
        </h1>
        <p className="text-white/60 text-lg">
          Join Polverify as a verified security auditor and start issuing credentials
        </p>
        
        {/* Application Status Banner */}
        {applicationStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <GlassCard className={`p-4 border-2 ${
              applicationStatus === 'approved' ? 'border-green-400/30 bg-green-500/10' :
              applicationStatus === 'rejected' ? 'border-red-400/30 bg-red-500/10' :
              'border-yellow-400/30 bg-yellow-500/10'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {applicationStatus === 'approved' ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <div>
                        <div className="text-white font-semibold">Application Approved!</div>
                        <div className="text-white/60 text-sm">You can now issue credentials on the Auditor Dashboard</div>
                      </div>
                    </>
                  ) : applicationStatus === 'rejected' ? (
                    <>
                      <XCircle className="w-5 h-5 text-red-400" />
                      <div>
                        <div className="text-white font-semibold">Application Rejected</div>
                        <div className="text-white/60 text-sm">Please contact admin for more information</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Clock className="w-5 h-5 text-yellow-400" />
                      <div>
                        <div className="text-white font-semibold">Application Pending Review</div>
                        <div className="text-white/60 text-sm">Admin will review your application shortly</div>
                      </div>
                    </>
                  )}
                </div>
                {applicationStatus === 'approved' && (
                  <button
                    onClick={() => router.push('/auditor')}
                    className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg transition-colors text-sm"
                  >
                    Go to Dashboard →
                  </button>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </motion.div>

      {/* Application Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <GlassCard className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Wallet Address */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <Wallet className="w-4 h-4" />
                Wallet Address *
              </label>
              <Input
                name="walletAddress"
                placeholder="0x..."
                value={mounted ? formData.walletAddress : ''}
                onChange={handleChange}
                required
                disabled={mounted && isConnected}
                className="bg-white/5 border-white/20 focus:border-indigo-400 text-white font-mono"
              />
              {mounted && isConnected && (
                <p className="text-xs text-indigo-400 mt-1">
                  ✓ Using your connected wallet address
                </p>
              )}
              <p className="text-xs text-white/50 mt-1">
                This is the address you'll use to issue credentials
              </p>
            </div>

            {/* GitHub Handle */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <Github className="w-4 h-4" />
                GitHub Handle
              </label>
              <Input
                name="githubHandle"
                placeholder="username"
                value={formData.githubHandle}
                onChange={handleChange}
                className="bg-white/5 border-white/20 focus:border-indigo-400 text-white"
              />
              <p className="text-xs text-white/50 mt-1">
                Your GitHub username (we'll verify your audit repositories)
              </p>
            </div>

            {/* Code4rena Handle */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <Shield className="w-4 h-4" />
                Code4rena Handle
              </label>
              <Input
                name="code4renaHandle"
                placeholder="username"
                value={formData.code4renaHandle}
                onChange={handleChange}
                className="bg-white/5 border-white/20 focus:border-indigo-400 text-white"
              />
              <p className="text-xs text-white/50 mt-1">
                Your Code4rena username (we'll verify your findings)
              </p>
            </div>

            {/* Immunefi Handle */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <Bug className="w-4 h-4" />
                Immunefi Handle
              </label>
              <Input
                name="immunefiHandle"
                placeholder="username"
                value={formData.immunefiHandle}
                onChange={handleChange}
                className="bg-white/5 border-white/20 focus:border-indigo-400 text-white"
              />
              <p className="text-xs text-white/50 mt-1">
                Your Immunefi username (we'll verify your bounty submissions)
              </p>
            </div>

            {/* Optional Message */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <FileText className="w-4 h-4" />
                Additional Message (Optional)
              </label>
              <textarea
                name="message"
                placeholder="Tell us about your auditing experience, notable findings, or anything else..."
                value={formData.message}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent text-white placeholder:text-white/30 resize-none"
              />
            </div>

            {/* Info Box */}
            <div className="bg-indigo-500/10 border border-indigo-400/20 rounded-lg p-4">
              <p className="text-sm text-white/70">
                <strong className="text-white">Note:</strong> You must provide at least one platform handle 
                (GitHub, Code4rena, or Immunefi) for verification. Our admin will review your work history 
                and calculate your credibility score based on your verified contributions.
              </p>
            </div>

            {/* Submit Button */}
            <GradientButton
              type="submit"
              isLoading={loading}
              disabled={loading || !formData.walletAddress || applicationStatus === 'pending' || applicationStatus === 'approved'}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              {loading ? 'Submitting...' : 
               applicationStatus === 'pending' ? 'Application Pending' :
               applicationStatus === 'approved' ? 'Already Approved' :
               'Submit Application'}
            </GradientButton>
            
            {/* Status Check Button */}
            {formData.walletAddress && !applicationStatus && (
              <button
                type="button"
                onClick={() => checkApplicationStatus(formData.walletAddress)}
                disabled={checkingStatus}
                className="w-full px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-white text-sm flex items-center justify-center gap-2"
              >
                {checkingStatus ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Checking...
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    Check Application Status
                  </>
                )}
              </button>
            )}

            {/* Connect Wallet Notice */}
            {!isConnected && (
              <p className="text-xs text-yellow-400 text-center">
                💡 Connect your wallet to auto-fill your address
              </p>
            )}
          </form>
        </GlassCard>
      </motion.div>

      {/* Why Apply Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <GlassCard className="p-6">
          <h3 className="text-xl font-bold text-white mb-4">Why Become a Verified Auditor?</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="text-white font-semibold mb-2">✓ Credibility Tracking</h4>
              <p className="text-white/60 text-sm">
                Your verified work history builds your credibility score, making you more trustworthy
              </p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="text-white font-semibold mb-2">✓ Issue Credentials</h4>
              <p className="text-white/60 text-sm">
                Once approved, you can issue verifiable audit credentials using zero-knowledge proofs
              </p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="text-white font-semibold mb-2">✓ Trust Indicators</h4>
              <p className="text-white/60 text-sm">
                Display your credibility score and verified work history to build trust with projects
              </p>
            </div>
            <div className="p-4 bg-white/5 rounded-lg">
              <h4 className="text-white font-semibold mb-2">✓ On-Chain Recognition</h4>
              <p className="text-white/60 text-sm">
                Your approval and credentials are permanently recorded on the blockchain
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

