/**
 * Script to anchor a credential in ProofVerifier for E2E testing
 * 
 * This script:
 * - Uses ADMIN_PRIVATE_KEY or PROOF_SIGNER_PRIVATE_KEY to sign transactions
 * - Connects to ProofVerifier contract
 * - Checks if credential is already anchored
 * - Anchors credential if not already anchored
 * - Is idempotent (safe to run multiple times)
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function anchorCredential(credentialId, summaryHash, issuer) {
  try {
    const rpcUrl = process.env.RPC_URL;
    // Use ADMIN_PRIVATE_KEY (deployer) since anchorCredential requires an approved auditor
    const signerKey = process.env.ADMIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    const proofVerifierAddress = process.env.PROOF_VERIFIER_ADDRESS;

    if (!rpcUrl || !signerKey || !proofVerifierAddress) {
      throw new Error("Missing required environment variables: RPC_URL, ADMIN_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY), PROOF_VERIFIER_ADDRESS");
    }

    // Load ABI
    const abiPath = path.join(__dirname, "..", "backend", "abi", "ProofVerifier.json");
    const ProofVerifierArtifact = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    const abi = Array.isArray(ProofVerifierArtifact) ? ProofVerifierArtifact : (ProofVerifierArtifact.abi || ProofVerifierArtifact);

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(signerKey.startsWith("0x") ? signerKey : `0x${signerKey}`, provider);
    const proofVerifier = new ethers.Contract(proofVerifierAddress, abi, signer);

    // Normalize addresses and convert credentialId to bytes32
    const normalizedIssuer = ethers.getAddress(issuer);
    let credentialIdBytes32;
    if (credentialId.startsWith("0x")) {
      credentialIdBytes32 = ethers.zeroPadValue(credentialId, 32);
    } else {
      credentialIdBytes32 = ethers.zeroPadValue("0x" + credentialId, 32);
    }
    
    let summaryHashBytes32;
    if (summaryHash.startsWith("0x")) {
      summaryHashBytes32 = ethers.zeroPadValue(summaryHash, 32);
    } else {
      summaryHashBytes32 = ethers.zeroPadValue("0x" + summaryHash, 32);
    }

    console.log(`\n🔍 Checking credential anchor status...`);
    console.log(`   Credential ID: ${credentialIdBytes32}`);
    console.log(`   Summary Hash: ${summaryHashBytes32}`);
    console.log(`   Issuer: ${normalizedIssuer}`);
    console.log(`   Signer: ${signer.address}\n`);

    // Check if already anchored
    const isAnchored = await proofVerifier.isCredentialAnchored(credentialIdBytes32);
    
    if (isAnchored) {
      console.log(`✅ Credential ${credentialIdBytes32} is already anchored`);
      return { anchored: true, alreadyAnchored: true };
    }

    // Anchor the credential
    console.log(`📝 Anchoring credential ${credentialIdBytes32}...`);
    const tx = await proofVerifier.anchorCredential(credentialIdBytes32, summaryHashBytes32, normalizedIssuer);
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    console.log(`✅ Credential anchored successfully!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

    // Verify anchoring
    const verified = await proofVerifier.isCredentialAnchored(credentialIdBytes32);
    if (!verified) {
      throw new Error("Credential anchor verification failed");
    }

    return { anchored: true, alreadyAnchored: false, txHash: receipt.hash, blockNumber: receipt.blockNumber };
  } catch (err) {
    console.error(`❌ Failed to anchor credential:`, err.message);
    if (err.reason) {
      console.error(`   Reason: ${err.reason}`);
    }
    throw err;
  }
}

// If run directly, anchor a test credential
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error("Usage: node anchor-credential.js <credentialId> <summaryHash> <issuer>");
    console.error("Example: node anchor-credential.js 0x1234... 0xabcd... 0x5678...");
    process.exit(1);
  }

  const [credentialId, summaryHash, issuer] = args;
  anchorCredential(credentialId, summaryHash, issuer)
    .then((result) => {
      if (result.alreadyAnchored) {
        console.log("\n✅ Script completed (credential was already anchored)");
      } else {
        console.log("\n✅ Script completed (credential anchored)");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Script failed:", err.message);
      process.exit(1);
    });
}

module.exports = { anchorCredential };

