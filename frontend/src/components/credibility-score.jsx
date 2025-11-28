'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Github, Shield, Bug, Info } from 'lucide-react';

const SOURCE_CONFIG = [
  { key: 'githubHandle', label: 'GitHub', icon: Github, href: (value) => `https://github.com/${value}` },
  { key: 'code4renaHandle', label: 'Code4rena', icon: Shield, href: (value) => `https://code4rena.com/@${value}` },
  { key: 'immunefiHandle', label: 'Immunefi', icon: Bug, href: (value) => `https://immunefi.com/profile/${value}` },
];

const CredibilityScore = ({ address, size = 'md', showBreakdown = false }) => {
  const [score, setScore] = useState(0);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [mounted, setMounted] = useState(false);

  const sizeConfig = {
    sm: { size: 60, strokeWidth: 4, fontSize: 'text-sm' },
    md: { size: 80, strokeWidth: 5, fontSize: 'text-lg' },
    lg: { size: 120, strokeWidth: 6, fontSize: 'text-2xl' }
  };

  const config = sizeConfig[size];
  const radius = (config.size - config.strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let timer;

    const fetchScore = async () => {
      if (!address) {
        setLoading(false);
        return;
      }

      try {
        const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:10000';
        const response = await fetch(`${BACKEND_URL}/api/reputation/${address}`);
        const data = await response.json();

        if (data.success && data.reputation) {
          setScore(data.reputation.credibilityScore || 0);
          setBreakdown(data.reputation);
        }
      } catch (error) {
        console.error('Error fetching credibility score:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchScore();
    timer = setInterval(fetchScore, 30000);

    return () => clearInterval(timer);
  }, [address, mounted]);

  const getScoreColor = (value) => {
    if (value > 70) return { color: '#059669', bg: 'bg-emerald-500/10', text: 'text-green-400' }; // Green
    if (value >= 40) return { color: '#d97706', bg: 'bg-amber-500/10', text: 'text-amber-400' }; // Yellow
    return { color: '#ef4444', bg: 'bg-red-500/10', text: 'text-red-400' }; // Red
  };

  const getScoreLabel = (value) => {
    if (value > 70) return 'Trusted';
    if (value >= 40) return 'Emerging';
    return 'Watchlist';
  };

  const scoreColor = getScoreColor(score);
  const normalizedScore = Math.min(score / 100, 1);
  const strokeDasharray = `${normalizedScore * circumference} ${circumference}`;

  const availableSources = breakdown
    ? SOURCE_CONFIG.filter(({ key }) => breakdown[key])
    : [];

  // Prevent hydration mismatch
  if (!mounted || loading) {
    return (
      <div className={`flex items-center justify-center ${config.fontSize}`}>
        <div 
          className={`rounded-full animate-pulse ${scoreColor.bg}`}
          style={{ width: config.size, height: config.size }}
        >
          <div className="flex items-center justify-center h-full">
            <span className="text-gray-400">...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <motion.div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        whileHover={{ scale: 1.05 }}
        transition={{ duration: 0.2 }}
      >
        <svg
          width={config.size}
          height={config.size}
          className="transform -rotate-90"
        >
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            stroke="#1f2937"
            strokeWidth={config.strokeWidth}
            fill="transparent"
          />
          <motion.circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            stroke={scoreColor.color}
            strokeWidth={config.strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - (normalizedScore * circumference) }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`font-bold ${config.fontSize} ${scoreColor.text}`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            {Math.round(score)}
          </motion.span>
          <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
            {getScoreLabel(score)}
            {availableSources.length > 0 && <Info className="w-3 h-3" />}
          </span>
        </div>
      </motion.div>

      {showTooltip && showBreakdown && breakdown && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute z-10 p-4 bg-slate-900 text-white rounded-lg shadow-xl border border-white/10 min-w-72 -top-2 left-full ml-4"
        >
          <div className="text-sm font-semibold mb-2">Credibility Breakdown</div>

          <div className="space-y-2 text-xs text-white/70">
            {availableSources.length > 0 && (
              <div>
                <div className="uppercase text-[10px] tracking-wide text-white/40 mb-1">Verified Sources</div>
                <div className="space-y-1">
                  {availableSources.map(({ key, label, icon: Icon, href }) => (
                    <a
                      key={key}
                      href={href(breakdown[key])}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-indigo-300 hover:text-indigo-200 transition-colors"
                    >
                      <Icon className="w-3 h-3" />
                      <span>{label}: {breakdown[key]}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {breakdown.github?.count !== undefined && (
              <div className="flex justify-between">
                <span>GitHub Repos</span>
                <span>{breakdown.github.count}</span>
              </div>
            )}

            {breakdown.code4rena?.count !== undefined && (
              <div className="flex justify-between">
                <span>Code4rena Findings</span>
                <span>{breakdown.code4rena.count}</span>
              </div>
            )}

            {breakdown.immunefi?.count !== undefined && (
              <div className="flex justify-between">
                <span>Immunefi Submissions</span>
                <span>{breakdown.immunefi.count}</span>
              </div>
            )}

            <div className="border-t border-white/10 pt-2 mt-3">
              <div className="flex justify-between font-semibold">
                <span>Total Score</span>
                <span className={scoreColor.text}>{Math.round(score)}</span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-white/40 mt-3 space-y-1">
            <div>Last updated: {new Date(breakdown.lastUpdated).toLocaleString()}</div>
            {breakdown.signature && (
              <div>Signer: {breakdown.signature.slice(0, 12)}…{breakdown.signature.slice(-6)}</div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CredibilityScore;