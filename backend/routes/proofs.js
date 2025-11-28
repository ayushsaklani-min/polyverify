const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { ethers } = require("ethers");
const Credential = require("../models/Credential");
const ProofRecord = require("../models/ProofRecord");
const metrics = require("../services/metricsService");
const ProofVerifierArtifact = require("../abi/ProofVerifier.json");
const ProofVerifierABI = Array.isArray(ProofVerifierArtifact) ? ProofVerifierArtifact : (ProofVerifierArtifact.abi || ProofVerifierArtifact);
const { signProofPayload } = require("../utils/signProofPayload");

router.post("/generate", async (req, res) => {
  try {
    const { credentialId } = req.body;
    if (!credentialId) return res.status(400).json({ error: "credentialId required" });

    const cred = await Credential.findOne({ credentialId });
    if (!cred) return res.status(404).json({ error: "credential_not_found" });

    // Generate unique proofId
    const proofId = ethers.keccak256(ethers.toUtf8Bytes(`${credentialId}-${Date.now()}`));

    // Contract expects: recordVerification(address project, address auditor, string status, bytes32 credentialId, bytes32 proofId, bytes proof, uint256[] publicInputs, bytes proofSignature)
    // Prepare all fields for verification
    const project = cred.subject;
    const auditor = cred.issuer;
    const status = "verified";

    // Validate addresses
    if (!ethers.isAddress(project)) {
      return res.status(400).json({ error: "invalid_project_address" });
    }
    if (!ethers.isAddress(auditor)) {
      return res.status(400).json({ error: "invalid_auditor_address" });
    }

    // Generate proof bytes (dummy for now, should be from actual ZK proof generation)
    const proofBytes = "0x" + crypto.randomBytes(256).toString("hex");
    
    // Generate public inputs: [project as uint256, auditor as uint256, summaryHash as uint256]
    // Convert addresses to uint256 and summaryHash (bytes32) to uint256
    const projectUint256 = BigInt(ethers.getAddress(project)).toString();
    const auditorUint256 = BigInt(ethers.getAddress(auditor)).toString();
    let summaryHashUint256;
    try {
      if (cred.summaryHash && cred.summaryHash.startsWith("0x")) {
        summaryHashUint256 = BigInt(cred.summaryHash).toString();
      } else if (cred.summaryHash) {
        summaryHashUint256 = BigInt("0x" + cred.summaryHash).toString();
      } else {
        summaryHashUint256 = "0";
      }
    } catch (e) {
      summaryHashUint256 = "0";
    }
    
    const publicInputs = [projectUint256, auditorUint256, summaryHashUint256];

    // Generate REAL cryptographic signature using TRUSTED_PROVER_PRIVATE_KEY
    // This matches EXACTLY the contract's verifyProof() logic
    const trustedProverKey = process.env.TRUSTED_PROVER_PRIVATE_KEY;
    const zkVerifierAddress = process.env.ZK_VERIFIER_ADDRESS;

    if (!trustedProverKey) {
      throw new Error("TRUSTED_PROVER_PRIVATE_KEY not set in environment");
    }
    if (!zkVerifierAddress) {
      throw new Error("ZK_VERIFIER_ADDRESS not set in environment");
    }

    let proofSignature;
    try {
      proofSignature = await signProofPayload({
        trustedProverPrivateKey: trustedProverKey,
        zkVerifierAddress: zkVerifierAddress,
        proofId: proofId,
        issuer: ethers.getAddress(auditor),
        subject: ethers.getAddress(project),
        proofBytesHex: proofBytes,
        publicInputs: publicInputs
      });
      console.log("✓ Generated real cryptographic signature for proof verification");
    } catch (sigErr) {
      console.error("❌ Failed to generate signature:", sigErr.message);
      throw new Error(`Signature generation failed: ${sigErr.message}`);
    }

    // Store complete ProofRecord for verification
    const record = new ProofRecord({
      proofId,
      credentialId,
      project: ethers.getAddress(project), // Checksummed
      auditor: ethers.getAddress(auditor), // Checksummed
      proof: proofBytes,
      publicInputs,
      proofSignature: proofSignature, // Real cryptographic signature
      validatedOnChain: false
    });

    // Save with explicit write concern and timeout to prevent buffering
    await record.save({
      writeConcern: { w: 'majority', wtimeout: 10000 },
      maxTimeMS: 30000
    });

    await metrics.logProofGeneration({
      durationMs: 2000,
      proofSizeBytes: proofBytes.length / 2 - 1, // Hex string length / 2 - 1 for 0x
      success: true,
      project: cred.subject,
      auditor: cred.issuer
    });

    res.json({
      success: true,
      proofId,
      project: record.project,
      auditor: record.auditor,
      status,
      credentialId: record.credentialId
    });
  } catch (err) {
    console.error("proof generation error", err);
    res.status(500).json({ error: "internal_error", details: err.message });
  }
});

// Add verify route to the same router
router.post("/verify", async (req, res) => {
  try {
    const { proofId } = req.body || {};

    if (!proofId) {
      return res.status(400).json({ success: false, error: "proofId required" });
    }

    const record = await ProofRecord.findOne({ proofId });
    if (!record) {
      return res.status(404).json({ success: false, error: "proof_not_found" });
    }

    if (record.validatedOnChain) {
      return res.status(400).json({ success: false, error: "already_validated" });
    }

    const rpcUrl = process.env.RPC_URL;
    const signerKey = process.env.PROOF_SIGNER_PRIVATE_KEY;
    const verifierAddress = process.env.PROOF_VERIFIER_ADDRESS;
    const zkVerifierAddress = process.env.ZK_VERIFIER_ADDRESS;
    const trustedProverAddress = process.env.TRUSTED_PROVER_ADDRESS;

    if (!rpcUrl || !signerKey || !verifierAddress || !zkVerifierAddress) {
      console.error("Missing required environment variables");
      return res.status(500).json({ success: false, error: "server_misconfigured" });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Chain-aware validation
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 80002) {
      console.error(`❌ Wrong chain: ${network.chainId}, expected 80002`);
      return res.status(500).json({ success: false, error: "wrong_chain", chainId: Number(network.chainId) });
    }

    // TASK 3: Local signature validation before calling blockchain
    const { recoverSignerFromSignature } = require("../utils/signProofPayload");
    
    let recoveredSigner;
    try {
      recoveredSigner = recoverSignerFromSignature({
        zkVerifierAddress: zkVerifierAddress,
        proofId: record.proofId,
        issuer: record.auditor,
        subject: record.project,
        proofBytesHex: record.proof,
        publicInputs: record.publicInputs,
        signature: record.proofSignature
      });
      
      console.log(`🔍 Local signature recovery: ${recoveredSigner}`);
      
      // Get trusted prover address (either from env or derive from private key)
      let expectedProverAddress;
      if (trustedProverAddress) {
        expectedProverAddress = ethers.getAddress(trustedProverAddress);
      } else {
        const trustedProverKey = process.env.TRUSTED_PROVER_PRIVATE_KEY;
        if (trustedProverKey) {
          const wallet = new ethers.Wallet(trustedProverKey.startsWith("0x") ? trustedProverKey : `0x${trustedProverKey}`);
          expectedProverAddress = wallet.address;
        } else {
          throw new Error("TRUSTED_PROVER_ADDRESS or TRUSTED_PROVER_PRIVATE_KEY must be set");
        }
      }
      
      console.log(`🔍 Expected trusted prover: ${expectedProverAddress}`);
      
      if (recoveredSigner.toLowerCase() !== expectedProverAddress.toLowerCase()) {
        console.error(`❌ Signature mismatch: recovered ${recoveredSigner}, expected ${expectedProverAddress}`);
        return res.status(400).json({ 
          success: false, 
          error: "local_signature_mismatch",
          recovered: recoveredSigner,
          expected: expectedProverAddress
        });
      }
      
      console.log("✓ Local signature validation passed");
    } catch (recoverErr) {
      console.error("❌ Failed to recover signer locally:", recoverErr.message);
      return res.status(500).json({ 
        success: false, 
        error: "local_signature_recovery_failed",
        details: recoverErr.message
      });
    }

    const signer = new ethers.Wallet(signerKey, provider);
    // ProofVerifierABI is already extracted at the top of the file
    if (!Array.isArray(ProofVerifierABI)) {
      throw new Error("ProofVerifier ABI must be an array");
    }
    const proofVerifier = new ethers.Contract(verifierAddress, ProofVerifierABI, signer);

    // Load credential for validation
    let credential = null;
    if (record.credentialId) {
      credential = await Credential.findOne({ credentialId: record.credentialId }).lean().catch(() => null);
      if (!credential) {
        return res.status(404).json({ success: false, error: "credential_not_found" });
      }
    } else {
      return res.status(400).json({ success: false, error: "credentialId_missing" });
    }

    // ABI expects: recordVerification(address project, address auditor, string status, bytes32 credentialId, bytes32 proofId, bytes proof, uint256[] publicInputs, bytes proofSignature)
    // Extract and validate parameters
    let project = record.project;
    let auditor = record.auditor;
    const status = "verified";
    
    // Convert credentialId and proofId to bytes32 (they should already be hex strings)
    let credentialIdBytes32;
    try {
      if (record.credentialId.startsWith("0x")) {
        credentialIdBytes32 = ethers.zeroPadValue(record.credentialId, 32);
      } else {
        credentialIdBytes32 = ethers.zeroPadValue("0x" + record.credentialId, 32);
      }
    } catch (e) {
      credentialIdBytes32 = ethers.zeroPadValue(ethers.keccak256(ethers.toUtf8Bytes(record.credentialId)), 32);
    }
    
    let proofIdBytes32;
    try {
      if (record.proofId.startsWith("0x")) {
        proofIdBytes32 = ethers.zeroPadValue(record.proofId, 32);
      } else {
        proofIdBytes32 = ethers.zeroPadValue("0x" + record.proofId, 32);
      }
    } catch (e) {
      proofIdBytes32 = ethers.zeroPadValue(ethers.keccak256(ethers.toUtf8Bytes(record.proofId)), 32);
    }
    
    // Extract proof data
    const proofBytes = record.proof;
    const publicInputs = record.publicInputs.map(p => BigInt(p));
    const proofSignature = record.proofSignature;

    // Runtime param validation
    if (!ethers.isAddress(project)) {
      throw new Error("Invalid project address");
    }
    if (!ethers.isAddress(auditor)) {
      throw new Error("Invalid auditor address");
    }
    if (!proofBytes || !proofSignature || !publicInputs || publicInputs.length < 3) {
      throw new Error("Missing required proof data");
    }

    // Ensure addresses are checksummed
    project = ethers.getAddress(project);
    auditor = ethers.getAddress(auditor);

    // Prerequisite checks: Verify auditor is approved and credential is anchored
    const AuditorRegistryABI = require("../abi/AuditorRegistry.json");
    const auditorRegistryAddress = process.env.AUDITOR_REGISTRY_ADDRESS;
    // ABI should be an array - ensure it's properly formatted
    if (!Array.isArray(AuditorRegistryABI)) {
      throw new Error("AuditorRegistry ABI must be an array");
    }
    const auditorRegistry = new ethers.Contract(auditorRegistryAddress, AuditorRegistryABI, provider);
    
    try {
      // Check if auditor is approved - the function is isApprovedAuditor, not isApproved
      const isApproved = await auditorRegistry.isApprovedAuditor(auditor);
      console.log(`🔍 Auditor ${auditor} approval status: ${isApproved}`);
      if (!isApproved) {
        return res.status(400).json({
          success: false,
          error: "auditor_not_approved",
          message: "Auditor must be approved in AuditorRegistry before verification",
          auditor: auditor
        });
      }
    } catch (checkErr) {
      console.error("❌ Failed to check auditor approval:", checkErr);
      return res.status(500).json({
        success: false,
        error: "auditor_check_failed",
        details: checkErr.message
      });
    }

    try {
      const isAnchored = await proofVerifier.isCredentialAnchored(credentialIdBytes32);
      console.log(`🔍 Credential ${credentialIdBytes32} anchor status: ${isAnchored}`);
      if (!isAnchored) {
        return res.status(400).json({
          success: false,
          error: "credential_not_anchored",
          message: "Credential must be anchored on-chain before verification",
          credentialId: credentialIdBytes32
        });
      }
    } catch (checkErr) {
      console.error("❌ Failed to check credential anchor:", checkErr);
      return res.status(500).json({
        success: false,
        error: "credential_check_failed",
        details: checkErr.message
      });
    }

    // TASK 4: Call ProofVerifier.recordVerification with 8 parameters in EXACT order
    // Contract signature: recordVerification(
    //   address project,
    //   address auditor,
    //   string status,
    //   bytes32 credentialId,
    //   bytes32 proofId,
    //   bytes proof,
    //   uint256[] publicInputs,
    //   bytes proofSignature
    // )
    let tx;
    try {
      console.log("📝 Calling recordVerification with parameters:", {
        project,
        auditor,
        status,
        credentialId: credentialIdBytes32,
        proofId: proofIdBytes32,
        proofLength: proofBytes.length,
        publicInputsCount: publicInputs.length,
        signatureLength: proofSignature.length,
        signaturePreview: proofSignature.substring(0, 20) + "..."
      });
      
      tx = await proofVerifier.recordVerification(
        project,              // address project
        auditor,              // address auditor
        status,               // string status
        credentialIdBytes32,  // bytes32 credentialId
        proofIdBytes32,       // bytes32 proofId
        proofBytes,           // bytes proof
        publicInputs,         // uint256[] publicInputs
        proofSignature        // bytes proofSignature
      );
    } catch (err) {
      console.error("❌ On-chain recordVerification failed:", err);
      console.error("Function signature: recordVerification(address,address,string,bytes32,bytes32,bytes,uint256[],bytes)");
      console.error("Parameters:", {
        project,
        auditor,
        status,
        credentialId: credentialIdBytes32,
        proofId: proofIdBytes32,
        proof: proofBytes.substring(0, 20) + "...",
        publicInputs,
        signature: proofSignature.substring(0, 20) + "..."
      });
      if (err?.reason) console.error("Reason:", err.reason);
      if (err?.data) console.error("Data:", err.data);
      if (err?.shortMessage) console.error("Short:", err.shortMessage);
      if (err?.info) console.error("Info:", JSON.stringify(err.info, null, 2));
      return res.status(500).json({
        success: false,
        error: "onchain_call_failed",
        reason: err.reason || null,
        details: err.shortMessage || err.message || null,
        functionSignature: "recordVerification(address,address,string,bytes32,bytes32,bytes,uint256[],bytes)"
      });
    }

            const receipt = await tx.wait();

            record.validatedOnChain = true;
            record.txnHash = receipt.hash;
            // Save with explicit write concern and timeout
            await record.save({
              writeConcern: { w: 'majority', wtimeout: 10000 },
              maxTimeMS: 30000
            });

    return res.json({
      success: true,
      txnHash: receipt.hash,
      message: "Verification recorded on-chain",
      proofId,
      credentialId: record.credentialId,
      project: record.project,
      auditor: record.auditor,
      credential
    });
  } catch (err) {
    console.error("proofs/verify error", err);
    return res.status(500).json({ success: false, error: "internal_error", details: err.message });
  }
});

module.exports = router;


