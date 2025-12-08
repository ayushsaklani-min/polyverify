/**
 * Deploy ZK-Upgraded Contracts
 * 
 * Deploys the enhanced ZKVerifierGroth16 contract that supports
 * both Groth16 ZK-SNARK proofs and signature-based verification.
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying ZK-Upgraded Contracts...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Step 1: Deploy Groth16Verifier (if circuit is compiled)
  let groth16VerifierAddress = ethers.ZeroAddress;
  const groth16VerifierPath = path.join(__dirname, "../contracts/Groth16Verifier.sol");
  
  if (fs.existsSync(groth16VerifierPath)) {
    console.log("📊 Deploying Groth16Verifier contract...");
    try {
      const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
      const groth16Verifier = await Groth16Verifier.deploy();
      await groth16Verifier.waitForDeployment();
      groth16VerifierAddress = await groth16Verifier.getAddress();
      console.log("✅ Groth16Verifier deployed to:", groth16VerifierAddress);
    } catch (error) {
      console.warn("⚠️  Groth16Verifier deployment failed:", error.message);
      console.warn("   Continuing without Groth16 support (will use signature verification)");
    }
  } else {
    console.log("⚠️  Groth16Verifier.sol not found. Run circuit setup first:");
    console.log("   cd circuits && npm run compile && npm run setup");
    console.log("   Continuing without Groth16 support...\n");
  }

  // Step 2: Deploy AuditorRegistry
  console.log("\n📊 Deploying AuditorRegistry...");
  const AuditorRegistry = await ethers.getContractFactory("AuditorRegistry");
  const auditorRegistry = await AuditorRegistry.deploy();
  await auditorRegistry.waitForDeployment();
  const auditorRegistryAddress = await auditorRegistry.getAddress();
  console.log("✅ AuditorRegistry deployed to:", auditorRegistryAddress);

  // Step 3: Deploy ZKVerifierGroth16
  console.log("\n📊 Deploying ZKVerifierGroth16...");
  
  // Use deployer as trusted prover initially (can be changed later)
  const trustedProverAddress = deployer.address;
  
  const ZKVerifierGroth16 = await ethers.getContractFactory("ZKVerifierGroth16");
  const zkVerifier = await ZKVerifierGroth16.deploy(
    trustedProverAddress,
    groth16VerifierAddress
  );
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();
  console.log("✅ ZKVerifierGroth16 deployed to:", zkVerifierAddress);
  console.log("   Trusted Prover:", trustedProverAddress);
  console.log("   Groth16 Verifier:", groth16VerifierAddress === ethers.ZeroAddress ? "Not set" : groth16VerifierAddress);

  // Step 4: Deploy ProofVerifier
  console.log("\n📊 Deploying ProofVerifier...");
  const ProofVerifier = await ethers.getContractFactory("ProofVerifier");
  const proofVerifier = await ProofVerifier.deploy(
    auditorRegistryAddress,
    zkVerifierAddress
  );
  await proofVerifier.waitForDeployment();
  const proofVerifierAddress = await proofVerifier.getAddress();
  console.log("✅ ProofVerifier deployed to:", proofVerifierAddress);

  // Step 5: Configure AuditorRegistry
  console.log("\n⚙️  Configuring AuditorRegistry...");
  const setProofVerifierTx = await auditorRegistry.setProofVerifier(proofVerifierAddress);
  await setProofVerifierTx.wait();
  console.log("✅ ProofVerifier set in AuditorRegistry");

  // Step 6: Approve deployer as auditor (for testing)
  console.log("\n⚙️  Approving deployer as auditor...");
  const approveAuditorTx = await auditorRegistry.approveAuditor(deployer.address);
  await approveAuditorTx.wait();
  console.log("✅ Deployer approved as auditor");

  // Step 7: Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      AuditorRegistry: auditorRegistryAddress,
      ZKVerifierGroth16: zkVerifierAddress,
      ProofVerifier: proofVerifierAddress,
      Groth16Verifier: groth16VerifierAddress === ethers.ZeroAddress ? null : groth16VerifierAddress
    },
    config: {
      trustedProver: trustedProverAddress,
      groth16Enabled: groth16VerifierAddress !== ethers.ZeroAddress
    }
  };

  const deploymentPath = path.join(__dirname, "../deployment-zk-upgraded.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", deploymentPath);

  // Step 8: Generate .env template
  console.log("\n📝 Environment Variables:");
  console.log("─────────────────────────────────────────────────────────");
  console.log("# Add these to your .env file:");
  console.log("");
  console.log("# Contract Addresses");
  console.log(`AUDITOR_REGISTRY_ADDRESS=${auditorRegistryAddress}`);
  console.log(`ZK_VERIFIER_ADDRESS=${zkVerifierAddress}`);
  console.log(`PROOF_VERIFIER_ADDRESS=${proofVerifierAddress}`);
  if (groth16VerifierAddress !== ethers.ZeroAddress) {
    console.log(`GROTH16_VERIFIER_ADDRESS=${groth16VerifierAddress}`);
  }
  console.log("");
  console.log("# Trusted Prover (use a dedicated key in production!)");
  console.log(`TRUSTED_PROVER_ADDRESS=${trustedProverAddress}`);
  console.log(`TRUSTED_PROVER_PRIVATE_KEY=<your-private-key>`);
  console.log("");
  console.log("# ZK Configuration");
  console.log(`ZK_PROOF_ENABLED=${groth16VerifierAddress !== ethers.ZeroAddress}`);
  console.log("─────────────────────────────────────────────────────────");

  // Step 9: Verification instructions
  console.log("\n✅ Deployment Complete!\n");
  console.log("📋 Next Steps:");
  console.log("1. Update your .env file with the addresses above");
  console.log("2. If Groth16 is not enabled, run circuit setup:");
  console.log("   cd circuits && npm install && npm run compile && npm run setup");
  console.log("3. Restart your backend server");
  console.log("4. Test proof generation:");
  console.log("   curl -X POST http://localhost:10000/api/proofs/generate \\");
  console.log("     -H 'Content-Type: application/json' \\");
  console.log("     -d '{\"credentialId\":\"test\",\"vulnerabilityCount\":5,\"severityScore\":250}'");
  console.log("");
  console.log("🔐 Security Reminder:");
  console.log("- Use a dedicated private key for TRUSTED_PROVER in production");
  console.log("- Run a multi-party trusted setup ceremony for production ZK circuits");
  console.log("- Audit the circuit code before mainnet deployment");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
