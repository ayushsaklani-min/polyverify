/**
 * Script to issue and anchor a credential in ProofVerifier for E2E testing
 * 
 * This script:
 * - Uses ADMIN_PRIVATE_KEY (approved auditor) to sign transactions
 * - Connects to ProofVerifier contract
 * - Issues the credential (stores credential data)
 * - Anchors the credential (marks it as anchored)
 * - Is idempotent (safe to run multiple times)
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function issueAndAnchorCredential(credentialId, subject, summaryHash, issuer) {
  try {
    const rpcUrl = process.env.RPC_URL;
    // Use ADMIN_PRIVATE_KEY (deployer/approved auditor) since issueCredential requires an approved auditor
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

    // Normalize addresses and convert to bytes32
    const normalizedIssuer = ethers.getAddress(issuer);
    const normalizedSubject = ethers.getAddress(subject);
    
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

    // Generate a valid signature for credential issuance
    // Contract expects: keccak256(abi.encodePacked(id, subject, summaryHash))
    // Then: keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash))
    // Signature must be signed by msg.sender (the issuer)
    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ["bytes32", "address", "bytes32"],
        [credentialIdBytes32, normalizedSubject, summaryHashBytes32]
      )
    );
    
    const prefix = "\x19Ethereum Signed Message:\n32";
    const prefixedMessage = ethers.concat([
      ethers.toUtf8Bytes(prefix),
      ethers.getBytes(messageHash)
    ]);
    const ethSignedMessageHash = ethers.keccak256(prefixedMessage);
    
    // Sign with the issuer's private key
    const signingKey = new ethers.SigningKey(signerKey.startsWith("0x") ? signerKey : `0x${signerKey}`);
    const signature = signingKey.sign(ethSignedMessageHash);
    
    // Convert to 65-byte format: r (32 bytes) + s (32 bytes) + v (1 byte)
    const credentialSignature = ethers.concat([
      signature.r,
      signature.s,
      ethers.toBeArray(signature.v)
    ]);

    console.log(`\n🔍 Checking credential status...`);
    console.log(`   Credential ID: ${credentialIdBytes32}`);
    console.log(`   Subject: ${normalizedSubject}`);
    console.log(`   Summary Hash: ${summaryHashBytes32}`);
    console.log(`   Issuer: ${normalizedIssuer}`);
    console.log(`   Signer: ${signer.address}\n`);

    // Check if already anchored
    const isAnchored = await proofVerifier.isCredentialAnchored(credentialIdBytes32);
    
    if (isAnchored) {
      console.log(`✅ Credential ${credentialIdBytes32} is already anchored`);
      // Verify credential data exists
      try {
        const credential = await proofVerifier.getCredential(credentialIdBytes32);
        if (credential.issuer === normalizedIssuer && credential.id === credentialIdBytes32) {
          console.log(`✅ Credential data is correct\n`);
          return { issued: true, anchored: true, alreadyDone: true };
        }
      } catch (e) {
        // Credential data might not exist, need to issue it
        console.log(`⚠ Credential is anchored but data missing, issuing credential...`);
      }
    }

    // Issue the credential (stores credential data)
    console.log(`📝 Issuing credential ${credentialIdBytes32}...`);
    try {
      const issueTx = await proofVerifier.issueCredential(
        credentialIdBytes32,
        normalizedSubject,
        summaryHashBytes32,
        credentialSignature
      );
      console.log(`   Issue transaction hash: ${issueTx.hash}`);
      console.log(`   Waiting for confirmation...`);
      await issueTx.wait();
      console.log(`✅ Credential issued successfully!`);
    } catch (issueErr) {
      if (issueErr.reason && issueErr.reason.includes("already")) {
        console.log(`✓ Credential already issued`);
      } else {
        throw issueErr;
      }
    }

    // Note: issueCredential already anchors the credential, so we don't need to call anchorCredential separately
    console.log(`✅ Credential issued and anchored (issueCredential anchors automatically)\n`);

    // Verify
    const verified = await proofVerifier.isCredentialAnchored(credentialIdBytes32);
    if (!verified) {
      throw new Error("Credential anchor verification failed");
    }

    const credential = await proofVerifier.getCredential(credentialIdBytes32);
    if (credential.issuer !== normalizedIssuer) {
      throw new Error(`Credential issuer mismatch: expected ${normalizedIssuer}, got ${credential.issuer}`);
    }

    return { issued: true, anchored: true, alreadyDone: false };
  } catch (err) {
    console.error(`❌ Failed to issue/anchor credential:`, err.message);
    if (err.reason) {
      console.error(`   Reason: ${err.reason}`);
    }
    throw err;
  }
}

// If run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.error("Usage: node issue-credential.js <credentialId> <subject> <summaryHash> <issuer>");
    console.error("Example: node issue-credential.js 0x1234... 0x5678... 0xabcd... 0x9abc...");
    process.exit(1);
  }

  const [credentialId, subject, summaryHash, issuer] = args;
  issueAndAnchorCredential(credentialId, subject, summaryHash, issuer)
    .then((result) => {
      if (result.alreadyDone) {
        console.log("\n✅ Script completed (credential was already issued and anchored)");
      } else {
        console.log("\n✅ Script completed (credential issued and anchored)");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Script failed:", err.message);
      process.exit(1);
    });
}

module.exports = { issueAndAnchorCredential };

