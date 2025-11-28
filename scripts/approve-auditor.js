/**
 * Script to approve an auditor in AuditorRegistry for E2E testing
 * 
 * This script:
 * - Uses ADMIN_PRIVATE_KEY to sign transactions
 * - Connects to AuditorRegistry contract
 * - Checks if auditor is already approved
 * - Approves auditor if not already approved
 * - Is idempotent (safe to run multiple times)
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function approveAuditor(auditorAddress) {
  try {
    const rpcUrl = process.env.RPC_URL;
    const adminKey = process.env.ADMIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    const auditorRegistryAddress = process.env.AUDITOR_REGISTRY_ADDRESS;

    if (!rpcUrl || !adminKey || !auditorRegistryAddress) {
      throw new Error("Missing required environment variables: RPC_URL, ADMIN_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY), AUDITOR_REGISTRY_ADDRESS");
    }

    // Load ABI
    const abiPath = path.join(__dirname, "..", "backend", "abi", "AuditorRegistry.json");
    const AuditorRegistryABI = JSON.parse(fs.readFileSync(abiPath, "utf8"));
    const abi = Array.isArray(AuditorRegistryABI) ? AuditorRegistryABI : (AuditorRegistryABI.abi || AuditorRegistryABI);

    // Setup provider and signer
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer = new ethers.Wallet(adminKey.startsWith("0x") ? adminKey : `0x${adminKey}`, provider);
    const auditorRegistry = new ethers.Contract(auditorRegistryAddress, abi, signer);

    // Normalize auditor address
    const normalizedAuditor = ethers.getAddress(auditorAddress);

    console.log(`\n🔍 Checking auditor approval status...`);
    console.log(`   Auditor: ${normalizedAuditor}`);
    console.log(`   Registry: ${auditorRegistryAddress}`);
    console.log(`   Admin: ${signer.address}\n`);

    // Check if already approved
    const isApproved = await auditorRegistry.isApprovedAuditor(normalizedAuditor);
    
    if (isApproved) {
      console.log(`✅ Auditor ${normalizedAuditor} is already approved`);
      return { approved: true, alreadyApproved: true };
    }

    // Approve the auditor
    console.log(`📝 Approving auditor ${normalizedAuditor}...`);
    const tx = await auditorRegistry.approveAuditor(normalizedAuditor);
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);
    
    const receipt = await tx.wait();
    console.log(`✅ Auditor approved successfully!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

    // Verify approval
    const verified = await auditorRegistry.isApprovedAuditor(normalizedAuditor);
    if (!verified) {
      throw new Error("Auditor approval verification failed");
    }

    return { approved: true, alreadyApproved: false, txHash: receipt.hash, blockNumber: receipt.blockNumber };
  } catch (err) {
    console.error(`❌ Failed to approve auditor:`, err.message);
    if (err.reason) {
      console.error(`   Reason: ${err.reason}`);
    }
    throw err;
  }
}

// If run directly, approve the deployer address
if (require.main === module) {
  const deployInfoPath = path.join(__dirname, "..", "deployment-info-polygon.json");
  let auditorAddress;
  
  if (fs.existsSync(deployInfoPath)) {
    const deployInfo = JSON.parse(fs.readFileSync(deployInfoPath, "utf8"));
    auditorAddress = deployInfo.deployer;
  } else {
    // Fallback to deployer from env
    const adminKey = process.env.ADMIN_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
    if (!adminKey) {
      console.error("❌ Cannot determine auditor address. Set DEPLOYER_PRIVATE_KEY or provide deployment-info-polygon.json");
      process.exit(1);
    }
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const signer = new ethers.Wallet(adminKey.startsWith("0x") ? adminKey : `0x${adminKey}`, provider);
    auditorAddress = signer.address;
  }

  approveAuditor(auditorAddress)
    .then((result) => {
      if (result.alreadyApproved) {
        console.log("\n✅ Script completed (auditor was already approved)");
      } else {
        console.log("\n✅ Script completed (auditor approved)");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Script failed:", err.message);
      process.exit(1);
    });
}

module.exports = { approveAuditor };

