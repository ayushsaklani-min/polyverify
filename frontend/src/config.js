// Frontend configuration helpers. Values should be provided via environment variables
// (e.g., NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS) after running Polygon Amoy deployments.

export const AUDITOR_REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS || '';
export const PROOF_VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS || '';
export const CONTRACT_ADDRESS = PROOF_VERIFIER_ADDRESS; // Legacy compatibility
export const ZK_VERIFIER_ADDRESS = process.env.NEXT_PUBLIC_ZK_VERIFIER_ADDRESS || '';
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 137);
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://polygonscan.com';
export const DEPLOYER_ADDRESS = process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS || '';
export const DEPLOYMENT_TIMESTAMP = Number(process.env.NEXT_PUBLIC_DEPLOYMENT_TIMESTAMP || Date.now());

// Debug logging
if (typeof window !== 'undefined') {
  console.log('[config.js] Environment variables loaded:');
  console.log('  PROOF_VERIFIER_ADDRESS:', PROOF_VERIFIER_ADDRESS);
  console.log('  CONTRACT_ADDRESS:', CONTRACT_ADDRESS);
  console.log('  All env vars:', {
    AUDITOR_REGISTRY_ADDRESS,
    PROOF_VERIFIER_ADDRESS,
    ZK_VERIFIER_ADDRESS,
    RPC_URL,
    CHAIN_ID
  });
}

export { default as AuditorRegistryABI } from '@/abi/AuditorRegistry.json';
export { default as ProofVerifierABI } from '@/abi/ProofVerifier.json';
export { default as ZKVerifierABI } from '@/abi/ZKVerifier.json';
export { default as ABI } from '@/abi/ProofVerifier.json';
