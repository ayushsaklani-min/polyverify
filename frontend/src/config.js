// Frontend configuration helpers. Values should be provided via environment variables
// (e.g., NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS) after running Polygon Amoy deployments.
const env = typeof process !== 'undefined' ? process.env : {};

export const AUDITOR_REGISTRY_ADDRESS = env.NEXT_PUBLIC_AUDITOR_REGISTRY_ADDRESS || '';
export const PROOF_VERIFIER_ADDRESS = env.NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS || '';
export const CONTRACT_ADDRESS = PROOF_VERIFIER_ADDRESS; // Legacy compatibility

// Debug logging
if (typeof window !== 'undefined') {
  console.log('[config.js] Environment variables loaded:');
  console.log('  PROOF_VERIFIER_ADDRESS:', PROOF_VERIFIER_ADDRESS);
  console.log('  CONTRACT_ADDRESS:', CONTRACT_ADDRESS);
}
export const ZK_VERIFIER_ADDRESS = env.NEXT_PUBLIC_ZK_VERIFIER_ADDRESS || '';
export const CHAIN_ID = Number(env.NEXT_PUBLIC_CHAIN_ID || 80002);
export const RPC_URL = env.NEXT_PUBLIC_RPC_URL || 'https://rpc-amoy.polygon.technology';
export const EXPLORER_URL = env.NEXT_PUBLIC_EXPLORER_URL || 'https://testnet-scan.polygon.technology';
export const DEPLOYER_ADDRESS = env.NEXT_PUBLIC_DEPLOYER_ADDRESS || '';
export const DEPLOYMENT_TIMESTAMP = Number(env.NEXT_PUBLIC_DEPLOYMENT_TIMESTAMP || Date.now());

export { default as AuditorRegistryABI } from '@/abi/AuditorRegistry.json';
export { default as ProofVerifierABI } from '@/abi/ProofVerifier.json';
export { default as ZKVerifierABI } from '@/abi/ZKVerifier.json';
export { default as ABI } from '@/abi/ProofVerifier.json';
