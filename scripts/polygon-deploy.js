const hre = require("hardhat");
const { ethers } = hre;
const fs = require("fs");

async function main() {
  console.log("Deploying to network:", hre.network.name);
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "MATIC\n");

  // Deploy AuditorRegistry (no constructor parameters)
  console.log("Deploying AuditorRegistry...");
  const AuditorRegistry = await ethers.getContractFactory("AuditorRegistry");
  const auditorRegistry = await AuditorRegistry.deploy();
  await auditorRegistry.waitForDeployment();
  const auditorRegistryAddress = await auditorRegistry.getAddress();
  console.log("✓ AuditorRegistry deployed at:", auditorRegistryAddress);

  // Deploy ZKVerifier (takes trustedProver address, using deployer for now)
  console.log("Deploying ZKVerifier...");
  const ZKVerifier = await ethers.getContractFactory("ZKVerifier");
  const zkVerifier = await ZKVerifier.deploy(deployer.address);
  await zkVerifier.waitForDeployment();
  const zkVerifierAddress = await zkVerifier.getAddress();
  console.log("✓ ZKVerifier deployed at:", zkVerifierAddress);

  // Deploy ProofVerifier (takes auditorRegistry and zkVerifier addresses)
  console.log("Deploying ProofVerifier...");
  const ProofVerifier = await ethers.getContractFactory("ProofVerifier");
  const proofVerifier = await ProofVerifier.deploy(auditorRegistryAddress, zkVerifierAddress);
  await proofVerifier.waitForDeployment();
  const proofVerifierAddress = await proofVerifier.getAddress();
  console.log("✓ ProofVerifier deployed at:", proofVerifierAddress);

  // Link ProofVerifier to AuditorRegistry
  console.log("\nLinking contracts...");
  try {
    const tx = await auditorRegistry.setProofVerifier(proofVerifierAddress);
    await tx.wait();
    console.log("✓ ProofVerifier linked to AuditorRegistry");
  } catch (e) {
    console.warn("⚠ setProofVerifier failed:", e.message);
  }

  // Save deployment info
  const network = await ethers.provider.getNetwork();
  const out = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    AuditorRegistry: auditorRegistryAddress,
    ZKVerifier: zkVerifierAddress,
    ProofVerifier: proofVerifierAddress,
    deployedAt: new Date().toISOString()
  };
  fs.writeFileSync("deployment-info-polygon.json", JSON.stringify(out, null, 2));
  console.log("\n✓ Deployment info saved to deployment-info-polygon.json");
  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(out, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

