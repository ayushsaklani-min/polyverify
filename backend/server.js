/**
 * Polverify — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Express.js API server for credential issuance, proof generation, and verification.
 * Handles admin authentication, reputation scoring, and metrics collection.
 */

// Load environment variables FIRST, before any other requires that depend on them
const path = require("path");
const envPath = path.join(__dirname, ".env");
const result = require("dotenv").config({ path: envPath });

if (result.error) {
  // .env file not found - this is OK in production (Render uses environment variables)
  if (process.env.NODE_ENV === 'production') {
    console.log("[server] Running in production mode - using environment variables from hosting platform");
  } else {
    console.warn("[server] Warning: .env file not found:", result.error.message);
  }
} else {
  console.log("[server] ✓ Environment variables loaded from:", envPath);
}

console.log("[server] Environment check:");
console.log("  - NODE_ENV:", process.env.NODE_ENV || "development");
console.log("  - ADMIN_ADDRESS:", process.env.ADMIN_ADDRESS ? "✓ Set" : "✗ Not found");
console.log("  - MONGO_URI:", process.env.MONGO_URI ? "✓ Set" : "✗ Not found");
console.log("  - RPC_URL:", process.env.RPC_URL ? "✓ Set" : "✗ Not found");

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { ethers } = require("ethers");
const axios = require("axios");
const { body, validationResult } = require("express-validator");
const { randomUUID } = require("crypto");
const connectDB = require("./config/db");
const ProofVerifierABI = require("./abi/ProofVerifier.json");
const AuditorRegistryABI = require("./abi/AuditorRegistry.json");
const adminAuth = require("./middleware/adminAuth");
const credentialStore = require("./services/credentialStore");
const metricsService = require("./services/metricsService");
const reputationService = require("./services/reputationService");
const auditorsRouter = require("./routes/auditors");
const adminRouter = require("./routes/admin");
const applyRouter = require("./routes/apply");
const proofsRouter = require("./routes/proofs");

const app = express();

// Trust proxy - required for Render and other hosting platforms
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://polyverify-g5qb.vercel.app",
        "https://polyverify.vercel.app",
        "https://polverify.vercel.app",
        "https://polverify-git-main-ayushsaklani-mins-projects.vercel.app",
        process.env.FRONTEND_URL,
        process.env.NEXT_PUBLIC_WEBSITE_URL,
      ].filter(Boolean);
      
      // Allow all Vercel preview deployments
      if (origin.includes('.vercel.app')) {
        return callback(null, true);
      }
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn('[CORS] Blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Connect to MongoDB once
(async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed", err);
    process.exit(1);
  }
})();

function requireEnv(key) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env: ${key}`);
    process.exit(1);
  }
}

[
  "RPC_URL",
  "MONGO_URI",
  "PROOF_SIGNER_PRIVATE_KEY",
  "AUDITOR_REGISTRY_ADDRESS",
  "PROOF_VERIFIER_ADDRESS",
  "ZK_VERIFIER_ADDRESS"
].forEach(requireEnv);

// Verify contract addresses are deployed on-chain
(async () => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    
    const contracts = [
      { name: "PROOF_VERIFIER_ADDRESS", address: process.env.PROOF_VERIFIER_ADDRESS },
      { name: "AUDITOR_REGISTRY_ADDRESS", address: process.env.AUDITOR_REGISTRY_ADDRESS },
      { name: "ZK_VERIFIER_ADDRESS", address: process.env.ZK_VERIFIER_ADDRESS }
    ];

    for (const { name, address } of contracts) {
      const code = await provider.getCode(address);
      if (code === "0x" || code === "0x0") {
        console.error(`❌ ${name} has no code on-chain at ${address}`);
        process.exit(1);
      }
      console.log(`✓ ${name} verified on-chain`);
    }
  } catch (err) {
    console.error("❌ Contract validation failed:", err.message);
    process.exit(1);
  }
})();

const RPC_URL = process.env.RPC_URL || "https://rpc-amoy.polygon.technology";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
const ZK_VERIFIER_ADDRESS = (
  process.env.ZK_VERIFIER_ADDRESS ||
  process.env.NEXT_PUBLIC_ZK_VERIFIER_ADDRESS ||
  ""
)
  .trim()
  .toLowerCase();

const abiCoder = ethers.AbiCoder.defaultAbiCoder()

function normalizePrivateKey(raw, label = 'private key') {
  if (!raw) throw new Error(`Missing ${label}`)
  const trimmed = String(raw).trim()
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (withPrefix.length !== 66) {
    throw new Error(`Invalid ${label} length (expected 32 bytes / 64 hex chars)`)
  }
  return withPrefix
}

function normalizeOptionalPrivateKey(raw, label = 'private key') {
  if (!raw) return null
  return normalizePrivateKey(raw, label)
}

const OPTIONAL_PROOF_KEY = normalizeOptionalPrivateKey(
  process.env.PROOF_SIGNER_PRIVATE_KEY || process.env.ADMIN_PRIVATE_KEY,
  'PROOF_SIGNER_PRIVATE_KEY'
)

let proofSigner = null
let proofSignerAddress = null

if (OPTIONAL_PROOF_KEY) {
  proofSigner = new ethers.Wallet(OPTIONAL_PROOF_KEY)
  proofSignerAddress = proofSigner.address.toLowerCase()
} else {
  console.warn('⚠️  Proof signer private key not configured; proof generation and verification will fail.')
}

let signer
let proofVerifierContract

function getContract() {
  if (!CONTRACT_ADDRESS) throw new Error('Missing CONTRACT_ADDRESS')
  if (!signer) {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    signer = new ethers.Wallet(normalizePrivateKey(PRIVATE_KEY), provider)
  }
  if (!proofVerifierContract) {
    proofVerifierContract = new ethers.Contract(CONTRACT_ADDRESS, ProofVerifierABI, signer)
  }
  return proofVerifierContract
}

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() })
  }
  next()
}

function buildProofDigest(credentialId, proofId, issuer, subject, proofHex, publicInputs) {
  if (!ZK_VERIFIER_ADDRESS) {
    throw new Error('ZK_VERIFIER_ADDRESS not configured')
  }
  const normalizedIssuer = ethers.getAddress(issuer)
  const normalizedSubject = ethers.getAddress(subject)
  const proofHash = ethers.keccak256(proofHex)
  const inputsHash = ethers.keccak256(abiCoder.encode(['uint256[]'], [publicInputs]))
  return ethers.keccak256(
    abiCoder.encode(
      ['address', 'bytes32', 'address', 'address', 'bytes32', 'bytes32'],
      [ethers.getAddress(ZK_VERIFIER_ADDRESS), proofId, normalizedIssuer, normalizedSubject, proofHash, inputsHash]
    )
  )
}

function verifySignedProof(signature, credentialId, proofId, issuer, subject, proofHex, publicInputs) {
  if (!signature || !proofSignerAddress) return false
  try {
    const digest = buildProofDigest(credentialId, proofId, issuer, subject, proofHex, publicInputs)
    const recovered = ethers.verifyMessage(ethers.getBytes(digest), signature)
    return recovered.toLowerCase() === proofSignerAddress
  } catch (err) {
    console.error('Proof signature verification failed:', err.message)
    return false
  }
}

const air3Client = axios.create({
  baseURL: process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'https://api.sandbox.air3.com',
  headers: {
    'x-partner-id': process.env.PARTNER_ID || process.env.NEXT_PUBLIC_PARTNER_ID,
    'Content-Type': 'application/json'
  }
})

function isNetworkError(err) {
  const code = err?.code || err?.errno || err?.response?.status
  const msg = (err?.message || '').toLowerCase()
  return (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    msg.includes('enotfound') ||
    msg.includes('network error') ||
    msg.includes('getaddrinfo')
  )
}

function logRoutes() {
  return [
      'GET /health',
    'GET /api',
    'POST /api/admin/login',
      'POST /api/issueCredential',
      'POST /api/proofs/generate',
      'POST /api/verifyProof',
      'GET /api/auditors',
      'GET /api/auditors/:address',
      'GET /api/auditors/:address/reputation',
      'POST /api/auditors/:address/refresh-reputation',
      'GET /api/auditors/:address/is-approved',
      'POST /api/apply',
      'GET /api/apply/pending',
      'GET /api/apply/:address',
      'GET /api/admin/applications',
    'POST /api/admin/approve-auditor',
      'POST /api/admin/reject-application',
    'GET /metrics'
  ]
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', network: 'polygon-amoy', rpc: RPC_URL, contract: CONTRACT_ADDRESS, verifier: ZK_VERIFIER_ADDRESS, adminAddress: adminAuth.adminAddress })
})

app.get('/api/admin/address', (_req, res) => {
  const adminAddress = adminAuth.adminAddress
  if (!adminAddress) {
    return res.status(500).json({ error: 'Admin address not configured' })
  }
  res.json({ adminAddress })
})

app.get('/', (_req, res) => {
  res.send('Polverify backend running. See /health and /api')
})

app.get('/api', (_req, res) => {
  res.json({ ok: true, routes: logRoutes() })
})

app.post('/api/admin/login', [
  body('timestamp').isInt().withMessage('timestamp required'),
  body('signature').isString().withMessage('signature required')
], handleValidation, (req, res) => {
  const { timestamp, signature } = req.body
  const address = adminAuth.adminAddress
  
  console.log('[Admin Login] Request received:', { timestamp, hasSignature: !!signature, adminAddress: address })
  
  if (!address) {
    console.error('[Admin Login] Admin address not configured')
    return res.status(500).json({ error: 'Admin address not configured' })
  }

  const messageHash = adminAuth.computeMessage('POST', '/api/admin/login', Number(timestamp), {})
  console.log('[Admin Login] Message hash:', messageHash)
  
  try {
    const recovered = ethers.verifyMessage(ethers.getBytes(messageHash), signature)
    console.log('[Admin Login] Recovered address:', recovered, 'Expected:', address)
    
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      console.error('[Admin Login] Address mismatch')
      return res.status(401).json({ error: 'Invalid admin signature' })
    }
    const token = adminAuth.issueToken(address)
    console.log('[Admin Login] Success, token issued')
    res.json({ token, admin: address })
  } catch (err) {
    console.error('[Admin Login] Error:', err.message)
    res.status(401).json({ error: err.message })
  }
})

function validateAddressParam(req, res, next) {
  if (req.params.address && !ethers.isAddress(req.params.address)) {
    return res.status(400).json({ success: false, error: 'Invalid address format' })
  }
  next()
}

app.use('/api/auditors', validateAddressParam, auditorsRouter)
app.use('/api/apply', applyRouter)
app.use('/api/admin', adminAuth.requireAdmin, adminRouter)
// Proof routes (/api/proofs/generate and /api/proofs/verify)
app.use('/api/proofs', proofsRouter)

app.get('/api/reputation/:address', validateAddressParam, async (req, res) => {
  const { address } = req.params
  try {
    const registryAddress = process.env.AUDITOR_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS
    if (!registryAddress) {
      return res.status(500).json({ error: 'Auditor registry is not configured' })
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const registry = new ethers.Contract(registryAddress, AuditorRegistryABI, provider)
    const info = await registry.getAuditorInfo(address)

    if (!info.isApproved) {
      return res.status(404).json({ error: 'Auditor not approved' })
    }

    const auditorInfo = {
      address,
      githubHandle: info.githubHandle,
      code4renaHandle: info.code4renaHandle,
      immunefiHandle: info.immunefiHandle,
      credentialCount: Number(info.credentialCount),
      approvedAt: Number(info.approvedAt) * 1000
    }

    const reputation = await reputationService.getAuditorReputation(auditorInfo)

    res.json({ success: true, reputation })
  } catch (err) {
    console.error('reputation endpoint error', err?.response?.data || err.message)
    res.status(500).json({ error: err?.response?.data?.message || err.message })
  }
})

app.get('/api/wallet', (_req, res) => {
  try {
    const wallet = new ethers.Wallet(normalizePrivateKey(PRIVATE_KEY))
    res.json({ address: wallet.address })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const issueCredentialValidators = [
  body('issuer').isString().custom((value) => ethers.isAddress(value)).withMessage('issuer must be a valid address'),
  body('subject').isString().custom((value) => ethers.isAddress(value)).withMessage('subject must be a valid address'),
  body('summaryHash').isString().custom((value) => ethers.isHexString(value, 32)).withMessage('summaryHash must be 32-byte hex'),
  body('status').isString().isLength({ min: 3 }).withMessage('status is required'),
  body('issuerSignature').isString().isLength({ min: 130 }).withMessage('issuerSignature is required')
]

async function issueCredentialHandler(req, res) {
  try {
    const { issuer, subject, summaryHash, status, issuerSignature } = req.body

    const normalizedIssuer = ethers.getAddress(issuer)
    const normalizedSubject = ethers.getAddress(subject)

    const recovered = ethers.verifyMessage(ethers.getBytes(summaryHash), issuerSignature)
    if (recovered.toLowerCase() !== normalizedIssuer.toLowerCase()) {
      return res.status(401).json({ error: 'Issuer signature mismatch' })
    }

    try {
      const registryAddress = process.env.AUDITOR_REGISTRY_ADDRESS || process.env.NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS
      if (registryAddress) {
        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const registry = new ethers.Contract(registryAddress, AuditorRegistryABI, provider)
        const isApproved = await registry.isApprovedAuditor(normalizedIssuer)
        if (!isApproved) {
          return res.status(403).json({ error: 'Only approved auditors can issue credentials' })
        }
      }
    } catch (err) {
      console.warn('Could not verify auditor approval:', err.message)
    }

    const payload = {
      partner_id: process.env.PARTNER_ID || process.env.NEXT_PUBLIC_PARTNER_ID,
      issuer_did: process.env.ISSUER_DID || process.env.NEXT_PUBLIC_ISSUER_DID,
      subject_did: normalizedSubject,
      verifier_did: process.env.VERIFIER_DID || process.env.NEXT_PUBLIC_VERIFIER_DID,
      credential_type: 'SmartContractAudit',
      logo_url: process.env.LOGO_URL || process.env.NEXT_PUBLIC_LOGO_URL,
      website_url: process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL,
      summary_hash: summaryHash,
      status,
      metadata: {
        name: process.env.PARTNER_NAME || process.env.NEXT_PUBLIC_PARTNER_NAME,
        issuer_address: normalizedIssuer
      },
      jwks_url: process.env.JWKS_URL || process.env.NEXT_PUBLIC_JWKS_URL
    }

    const response = await air3Client.post('/issuer/credentials', payload)
    const data = response.data || {}
    const credentialId = data.credential_id || data.id
    if (!credentialId) {
      return res.status(502).json({ error: 'Credential issuance response missing credential_id' })
    }

    const onChainId = ethers.keccak256(ethers.toUtf8Bytes(credentialId))

    const record = await credentialStore.upsertCredential({
      credentialId,
      onChainId,
      issuer: normalizedIssuer,
      subject: normalizedSubject,
      summaryHash: ethers.hexlify(summaryHash),
      status,
      issuedAt: data.issued_at || new Date().toISOString()
    })

    let serverSignature = null
    if (proofSigner && proofSignerAddress) {
      const digest = ethers.keccak256(
        abiCoder.encode(
          ['string', 'bytes32', 'address', 'address', 'bytes32'],
          ['polverify:credential:v1', onChainId, record.issuer, record.subject, record.summaryHash]
        )
      )
      serverSignature = await proofSigner.signMessage(ethers.getBytes(digest))
    }

    res.json({
      ...data,
      credential_id: credentialId,
      on_chain_id: onChainId,
      issuer: normalizedIssuer,
      subject: normalizedSubject,
      summary_hash: summaryHash,
      server_signature: serverSignature
    })
  } catch (err) {
    console.error('issueCredential error', err?.response?.data || err.message)
    const statusCode = err?.response?.status || 500
    res.status(statusCode).json({ error: err?.response?.data?.message || err.message })
  }
}

app.post('/api/issueCredential', issueCredentialValidators, handleValidation, issueCredentialHandler)
app.post('/api/issuecredential', issueCredentialValidators, handleValidation, issueCredentialHandler)
app.get('/api/issueCredential', (_req, res) => res.status(405).json({ error: 'Use POST /api/issueCredential' }))

const proofGenerationValidators = [
  body('credentialId').isString().withMessage('credentialId is required')
]

app.post('/api/proofs/generate', proofGenerationValidators, handleValidation, async (req, res) => {
  try {
    if (!proofSigner || !proofSignerAddress) {
      return res.status(500).json({ error: 'Proof signer not configured on backend' })
    }
    if (!ZK_VERIFIER_ADDRESS) {
      return res.status(500).json({ error: 'ZK_VERIFIER_ADDRESS is not set' })
    }

    const { credentialId } = req.body
    const credential = await Credential.findOne({ credentialId })
    if (!credential) {
      return res.status(404).json({ error: 'credential_not_found' })
    }

    const start = Date.now()
    const proofBytes = ethers.randomBytes(256)
    const proofHex = ethers.hexlify(proofBytes)
    const proofId = ethers.keccak256(ethers.concat([proofBytes, ethers.randomBytes(16)]))
    const onChainId = credential.onChainId || ethers.keccak256(ethers.toUtf8Bytes(credential.credentialId || credentialId))

    const publicInputs = [
      BigInt(ethers.getAddress(credential.subject)),
      BigInt(ethers.getAddress(credential.issuer)),
      BigInt(credential.summaryHash)
    ]

    const digest = buildProofDigest(onChainId, proofId, credential.issuer, credential.subject, proofHex, publicInputs)
    const signature = await proofSigner.signMessage(ethers.getBytes(digest))
    const durationMs = Date.now() - start

    await ProofRecord.create({
      proofId,
      credentialId,
      project: credential.subject,
      auditor: credential.issuer,
      signature,
      publicInputs: publicInputs.map((value) => value.toString())
    })

    await metricsService.logProofGeneration({
      credentialId,
      credentialOnChainId: onChainId,
      proofId,
      durationMs,
      proofSizeBytes: proofBytes.length,
      success: true,
      project: credential.subject,
      auditor: credential.issuer
    })

    res.json({
      proof_id: proofId,
      valid: true,
      credential_id: credentialId,
      on_chain_id: onChainId,
      proof_data: {
        proof: proofHex,
        publicInputs: publicInputs.map((value) => value.toString()),
        signature,
        signer: proofSignerAddress,
        zkVerifier: ZK_VERIFIER_ADDRESS
      },
      stats: {
        duration_ms: durationMs,
        proof_size_bytes: proofBytes.length
      }
    })
  } catch (err) {
    console.error('generateProof error', err?.response?.data || err.message)
    res.status(500).json({ error: err?.response?.data?.message || err.message })
  }
})

const verifyProofValidators = [
  body('project').isString().custom((value) => ethers.isAddress(value)).withMessage('project address invalid'),
  body('auditor').isString().custom((value) => ethers.isAddress(value)).withMessage('auditor address invalid'),
  body('status').isString().isLength({ min: 3 }).withMessage('status is required'),
  body('proof.credential_id').optional().isString().withMessage('credential_id must be a string'),
  body('proof.credentialId').optional().isString().withMessage('credentialId must be a string'),
  body('proof.proof_id').isString().withMessage('proof_id required'),
  body('proof.proof_data.proof').isString().custom((value) => ethers.isHexString(value)).withMessage('proof must be hex'),
  body('proof.proof_data.publicInputs').isArray({ min: 3 }).withMessage('publicInputs must include project, auditor, summary'),
  body('proof.proof_data.signature').isString().isLength({ min: 130 }).withMessage('signature required')
]

app.post('/api/verifyProof', verifyProofValidators, handleValidation, async (req, res) => {
  const { proof, project, auditor, status } = req.body
  const proofId = proof.proof_id || proof.proofId
  const credentialId = proof.credential_id || proof.credentialId
  const credentialOnChainId = proof.on_chain_id || proof.onChainId || (credentialId ? ethers.keccak256(ethers.toUtf8Bytes(credentialId)) : null)
  const proofHex = ethers.hexlify(proof.proof_data.proof)
  const publicInputs = proof.proof_data.publicInputs.map((value) => BigInt(value))
  const signature = proof.proof_data.signature

  if (!proofSignerAddress) {
    return res.status(500).json({ error: 'Proof signer not configured on backend' })
  }

  try {
    const normalizedProject = ethers.getAddress(project)
    const normalizedAuditor = ethers.getAddress(auditor)

    if (!credentialOnChainId) {
      return res.status(400).json({ error: 'Missing credential identifier' })
    }

    if (!verifySignedProof(signature, credentialOnChainId, proofId, normalizedAuditor, normalizedProject, proofHex, publicInputs)) {
      return res.status(401).json({ error: 'Proof signature invalid' })
    }

    const start = Date.now()
    const contract = getContract()
    const tx = await contract.recordVerification(
      normalizedProject,
      normalizedAuditor,
      status,
      credentialOnChainId,
      proofId,
      proofHex,
      publicInputs,
      signature
    )
    const receipt = await tx.wait()

    await ProofRecord.findOneAndUpdate(
      { proofId },
      { validatedOnChain: true, txHash: receipt.hash },
      { new: true }
    )

    await metricsService.logProofVerification({
      proofId,
      credentialId,
      credentialOnChainId,
      project: normalizedProject,
      auditor: normalizedAuditor,
      success: true,
      gasUsed: Number(receipt.gasUsed),
      latencyMs: Date.now() - start
    })

    res.json({ ok: true, txHash: receipt.hash, gasUsed: receipt.gasUsed.toString() })
  } catch (err) {
    await metricsService.logProofVerification({
      proofId,
      credentialId,
      credentialOnChainId,
      project,
      auditor,
      success: false,
      gasUsed: 0,
      latencyMs: 0,
      error: err.message
    })

    const msg = (err?.response?.data?.message || err.message || '').toLowerCase()
    console.error('verifyProof error', err?.response?.data || err.message)
    if (msg.includes('insufficient funds')) {
      return res.status(400).json({ error: 'Backend wallet has insufficient MATIC for gas' })
    }
    if (msg.includes('invalid') && msg.includes('private key')) {
      return res.status(500).json({ error: 'Invalid DEPLOYER_PRIVATE_KEY format. Ensure it is a 0x-prefixed 64-hex string.' })
    }
    res.status(500).json({ error: err?.response?.data?.message || err.message })
  }
})

app.get('/metrics', async (_req, res) => {
  try {
    const metrics = await metricsService.getMetrics()
    res.json(metrics)
  } catch (err) {
    console.error('metrics error', err)
    res.status(500).json({ error: 'Failed to load metrics' })
  }
})

const PORT = process.env.PORT || 10000
app.listen(PORT, () => console.log(`Backend listening on :${PORT}`))


