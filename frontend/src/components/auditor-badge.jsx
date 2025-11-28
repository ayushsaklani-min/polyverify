'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const AuditorBadge = ({ address, showScore = false, size = 'md' }) => {
  const [isApproved, setIsApproved] = useState(false);
  const [credibilityScore, setCredibilityScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const checkAuditorStatus = async () => {
      if (!address) {
        setLoading(false);
        return;
      }

      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
        const response = await fetch(`${BACKEND_URL}/api/auditors/${address}/is-approved`);
        const data = await response.json();
        
        if (data.success) {
          setIsApproved(data.isApproved);
          
          if (data.isApproved && showScore) {
            const reputationResponse = await fetch(`${BACKEND_URL}/api/auditors/${address}`);
            const reputationData = await reputationResponse.json();
            
            if (reputationData.success) {
              setCredibilityScore(reputationData.auditor.credibilityScore || 0);
            }
          }
        }
      } catch (error) {
        console.error('Error checking auditor status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuditorStatus();
  }, [address, showScore, mounted]);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className={`inline-flex items-center gap-1 bg-gray-100 text-gray-400 rounded-full ${sizeClasses[size]}`}>
        <div className={`${iconSizes[size]} bg-gray-300 rounded-full`}></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`inline-flex items-center gap-1 bg-gray-100 text-gray-400 rounded-full ${sizeClasses[size]} animate-pulse`}>
        <div className={`${iconSizes[size]} bg-gray-300 rounded-full`}></div>
        <span>Checking...</span>
      </div>
    );
  }

  if (!isApproved) {
    return null; // Don't show badge for non-approved auditors
  }

  const getScoreColor = (score) => {
    if (score >= 800) return 'text-purple-600';
    if (score >= 600) return 'text-blue-600';
    if (score >= 400) return 'text-green-600';
    if (score >= 200) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200 rounded-full ${sizeClasses[size]} font-medium`}
    >
      <motion.svg
        className={`${iconSizes[size]} text-green-600`}
        fill="currentColor"
        viewBox="0 0 20 20"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </motion.svg>
      <span>Verified Auditor</span>
      {showScore && credibilityScore > 0 && (
        <span className={`ml-1 font-bold ${getScoreColor(credibilityScore)}`}>
          ({credibilityScore})
        </span>
      )}
    </motion.div>
  );
};

export default AuditorBadge;