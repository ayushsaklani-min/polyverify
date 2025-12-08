/**
 * Trusted Setup Ceremony for ZK Circuit
 * 
 * This script performs the Powers of Tau ceremony and generates
 * the proving and verification keys for the audit verification circuit.
 */

const snarkjs = require("snarkjs");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔧 Starting trusted setup ceremony...\n");

  const buildDir = path.join(__dirname, "../build");
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // Step 1: Powers of Tau ceremony (Phase 1)
  console.log("📊 Phase 1: Powers of Tau ceremony");
  console.log("   Generating initial ceremony parameters...");
  
  await snarkjs.powersOfTau.newAccumulator(
    "bn128",
    12, // 2^12 = 4096 constraints (adjust based on circuit size)
    path.join(buildDir, "pot12_0000.ptau")
  );

  console.log("   Contributing to ceremony...");
  await snarkjs.powersOfTau.contribute(
    path.join(buildDir, "pot12_0000.ptau"),
    path.join(buildDir, "pot12_0001.ptau"),
    "zkverify_contribution",
    Buffer.from(Math.random().toString()).toString("hex")
  );

  console.log("   Preparing Phase 2...");
  await snarkjs.powersOfTau.preparePhase2(
    path.join(buildDir, "pot12_0001.ptau"),
    path.join(buildDir, "pot12_final.ptau")
  );

  // Step 2: Circuit-specific setup (Phase 2)
  console.log("\n📊 Phase 2: Circuit-specific setup");
  
  const r1csPath = path.join(buildDir, "audit_verification.r1cs");
  if (!fs.existsSync(r1csPath)) {
    console.error("❌ R1CS file not found. Please compile the circuit first:");
    console.error("   npm run compile");
    process.exit(1);
  }

  console.log("   Generating zkey 0...");
  await snarkjs.zKey.newZKey(
    r1csPath,
    path.join(buildDir, "pot12_final.ptau"),
    path.join(buildDir, "audit_verification_0000.zkey")
  );

  console.log("   Contributing to circuit-specific ceremony...");
  await snarkjs.zKey.contribute(
    path.join(buildDir, "audit_verification_0000.zkey"),
    path.join(buildDir, "audit_verification_0001.zkey"),
    "circuit_contribution",
    Buffer.from(Math.random().toString()).toString("hex")
  );

  console.log("   Exporting verification key...");
  const vKey = await snarkjs.zKey.exportVerificationKey(
    path.join(buildDir, "audit_verification_0001.zkey")
  );

  fs.writeFileSync(
    path.join(buildDir, "verification_key.json"),
    JSON.stringify(vKey, null, 2)
  );

  // Step 3: Generate Solidity verifier
  console.log("\n📊 Generating Solidity verifier contract...");
  const solidityCode = await snarkjs.zKey.exportSolidityVerifier(
    path.join(buildDir, "audit_verification_0001.zkey")
  );

  const verifierPath = path.join(__dirname, "../../contracts/Groth16Verifier.sol");
  fs.writeFileSync(verifierPath, solidityCode);

  console.log("\n✅ Trusted setup complete!");
  console.log("\n📁 Generated files:");
  console.log("   - build/pot12_final.ptau (Powers of Tau)");
  console.log("   - build/audit_verification_0001.zkey (Proving key)");
  console.log("   - build/verification_key.json (Verification key)");
  console.log("   - contracts/Groth16Verifier.sol (Solidity verifier)");
  console.log("\n⚠️  IMPORTANT: In production, use a multi-party ceremony!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  });
