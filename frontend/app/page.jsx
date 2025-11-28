"use client"

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ShieldCheck, Lock, Search, Sparkles, ArrowRight } from 'lucide-react'
import { FeatureCard } from '@/components/feature-card'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
}

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

export default function HomePage() {
  const features = [
    {
      icon: ShieldCheck,
      title: 'Auditor Issues Credential',
      description: 'Security auditors issue verifiable credentials using AIR Kit SDK, anchoring only summary hashes on-chain for complete privacy.',
      color: 'from-indigo-500 to-indigo-600'
    },
    {
      icon: Lock,
      title: 'Project Generates ZK Proof',
      description: 'Projects generate zero-knowledge proofs from credentials without ever revealing the private contents of audit reports.',
      color: 'from-purple-500 to-purple-600'
    },
    {
      icon: Search,
      title: 'Investors Verify On-Chain',
      description: 'Anyone can instantly verify audit status on Polygon Amoy using just a wallet address query.',
      color: 'from-pink-500 to-pink-600'
    }
  ]

  const stats = [
    { value: '100%', label: 'Privacy Preserved' },
    { value: 'Instant', label: 'On-Chain Verification' },
    { value: 'Polygon', label: 'Amoy Testnet' }
  ]

  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative py-20 md:py-32">
        <div className="container max-w-6xl mx-auto px-6">
          <motion.div
            className="text-center space-y-8"
            {...fadeInUp}
          >
            {/* Badge */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-gray-300">Powered by Zero-Knowledge Proofs</span>
            </motion.div>

            {/* Title */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  zkVerify
                </span>
              </h1>
              <h2 className="text-2xl md:text-4xl font-semibold text-gray-100">
                Verifiable Smart Contract Audit Credentials
              </h2>
            </div>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Prove your smart contracts have been audited without revealing private audit reports.
              Auditors issue credentials, projects generate proofs, and investors verify on-chain instantly.
            </p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
          <Link
            href="/apply"
            className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/60 transition-all duration-300"
          >
            Apply as Auditor
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/auditor"
            className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/60 transition-all duration-300"
          >
            I'm an Auditor
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/project"
            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border-2 border-white/20 hover:border-white/40 backdrop-blur-sm transition-all duration-300"
          >
            I'm a Project
          </Link>
          <Link
            href="/verify"
            className="px-8 py-4 text-gray-300 hover:text-white font-medium transition-colors duration-300"
          >
            Verify Status →
          </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container max-w-6xl mx-auto px-6">
          <div className="grid sm:grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <FeatureCard
                key={f.title}
                Icon={f.icon}
                title={f.title}
                description={f.description}
                gradient={f.color}
                delay={0.1 * (i + 1)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20">
        <div className="container max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative p-12 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10"
          >
            <div className="grid md:grid-cols-3 gap-8 md:gap-12">
              {stats.map((stat, index) => (
                <motion.div
                  key={index}
                  className="text-center"
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1, duration: 0.5 }}
                >
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-3">
                    {stat.value}
                  </div>
                  <div className="text-gray-400 font-medium">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-400">
              Four simple steps to verifiable audit credentials
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: '1', text: 'Auditors issue verifiable credentials to projects' },
              { step: '2', text: 'Projects generate zero-knowledge proofs' },
              { step: '3', text: 'Verification status recorded on-chain' },
              { step: '4', text: 'Anyone can verify using wallet address' }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
              >
                <div className="text-4xl font-bold text-indigo-400 mb-3">{item.step}</div>
                <p className="text-gray-300 leading-relaxed">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}