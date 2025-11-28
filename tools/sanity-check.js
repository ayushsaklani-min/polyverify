// Enhanced sanity check for Polygon Amoy deployment
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  const env = require("dotenv").config().parsed || process.env;

  const rpc = env.RPC_URL || "https://rpc-amoy.polygon.technology";
  const provider = new ethers.JsonRpcProvider(rpc);

  const deploymentPath = path.join(process.cwd(), "deployment-info-polygon.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error("deployment-info-polygon.json not found. Run deploy:polygon first.");
  }

  const dep = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

  const auditorRegistry = dep.AuditorRegistry;
  const proofVerifier = dep.ProofVerifier;
  const zkVerifier = dep.ZKVerifier;

  if (!auditorRegistry || !proofVerifier || !zkVerifier) {
    throw new Error("Missing contract addresses in deployment-info-polygon.json");
  }

  console.log("RPC URL:", rpc);

  // Basic RPC connectivity
  const blockNumber = await provider.getBlockNumber();
  console.log("Connected to RPC. Current block number:", blockNumber);

  // Check code at each contract
  const addrs = {
    AuditorRegistry: auditorRegistry,
    ProofVerifier: proofVerifier,
    ZKVerifier: zkVerifier
  };

  for (const [name, addr] of Object.entries(addrs)) {
    const code = await provider.getCode(addr);
    if (!code || code === "0x") {
      throw new Error(`No code found at ${name} address ${addr}`);
    }
    console.log(`${name} ${addr} code length ${code.length}`);
  }

  // Check required env vars
  const requiredEnv = [
    "RPC_URL",
    "PROOF_SIGNER_PRIVATE_KEY",
    "AUDITOR_REGISTRY_ADDRESS",
    "PROOF_VERIFIER_ADDRESS",
    "ZK_VERIFIER_ADDRESS"
  ];

  for (const key of requiredEnv) {
    if (!env[key]) {
      console.warn(`WARN: ${key} is not set in environment`);
    }
  }

  // Check signer balance
  if (env.PROOF_SIGNER_PRIVATE_KEY) {
    const signer = new ethers.Wallet(env.PROOF_SIGNER_PRIVATE_KEY, provider);
    const balance = await provider.getBalance(signer.address);
    console.log("Signer address:", signer.address);
    console.log("Signer balance (wei):", balance.toString());
    if (balance === 0n) {
      console.warn("WARN: Signer balance is zero. Transactions will fail.");
    }
  } else {
    console.warn("WARN: PROOF_SIGNER_PRIVATE_KEY not set; cannot check signer balance.");
  }

  console.log("Sanity checks completed successfully.");
}

main().catch((err) => {
  console.error("Sanity check failed:", err);
  process.exit(1);
});

