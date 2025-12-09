import { ethers } from 'ethers'
import abi from '@/abi/ProofVerifier.json'
import { CONTRACT_ADDRESS, RPC_URL } from '@/config'

export function getPublicProvider() {
  return new ethers.JsonRpcProvider(RPC_URL)
}

export async function getBrowserProvider() {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No injected provider found')
  }
  return new ethers.BrowserProvider(window.ethereum)
}

export async function getSigner() {
  const provider = await getBrowserProvider()
  return provider.getSigner()
}

export async function getContractWithSigner() {
  const signer = await getSigner()
  console.log('[ethers.js] CONTRACT_ADDRESS:', CONTRACT_ADDRESS)
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '') {
    throw new Error('CONTRACT_ADDRESS is not configured. Please check your environment variables.')
  }
  return new ethers.Contract(CONTRACT_ADDRESS, abi, signer)
}

export function getReadOnlyContract() {
  const provider = getPublicProvider()
  return new ethers.Contract(CONTRACT_ADDRESS, abi, provider)
}

