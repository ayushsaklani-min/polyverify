/**
 * Automated E2E integration test:
 * - Creates dummy credential in Mongo
 * - Calls /api/proofs/generate
 * - Waits briefly
 * - Calls /api/proofs/verify
 * - Prints proofId, txnHash, DB record, and explorer URL
 */

const axios = require("axios");
const { ethers } = require("ethers");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const Credential = require("../backend/models/Credential");
const ProofRecord = require("../backend/models/ProofRecord");
const { approveAuditor } = require("../scripts/approve-auditor");
const { issueAndAnchorCredential } = require("../scripts/issue-credential");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:10000";
const EXPLORER_URL = process.env.EXPLORER_URL || "https://testnet-scan.polygon.technology";

async function run() {
  try {
    console.log("🚀 Running E2E integration test…\n");

    // Step 0: Ensure auditor is approved
    console.log("🔐 Step 0: Ensuring auditor is approved...");
    const deployInfo = JSON.parse(require("fs").readFileSync(path.join(__dirname, "..", "deployment-info-polygon.json"), "utf8"));
    const auditorAddress = deployInfo.deployer || "0x48E8750b87278227b5BBd53cae998e6083910bd9";
    
    try {
      const approvalResult = await approveAuditor(auditorAddress);
      if (approvalResult.alreadyApproved) {
        console.log("✓ Auditor already approved\n");
      } else {
        console.log(`✓ Auditor approved in transaction: ${approvalResult.txnHash}\n`);
      }
    } catch (approvalErr) {
      console.error("⚠ Warning: Failed to approve auditor:", approvalErr.message);
      console.log("   Continuing with test (may fail if auditor not approved)...\n");
    }

            // Connect to MongoDB with retry logic
            if (!process.env.MONGO_URI) {
              throw new Error("MONGO_URI not set");
            }
            console.log("Connecting to MongoDB...");
            const mongoOptions = {
              serverSelectionTimeoutMS: 30000,
              socketTimeoutMS: 45000,
              connectTimeoutMS: 30000,
              maxPoolSize: 10,
              minPoolSize: 2,
              retryWrites: true,
              retryReads: true,
              // Note: keepAlive, bufferMaxEntries, bufferCommands are deprecated in newer MongoDB drivers
            };
            
            let mongoConnected = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                console.log(`[MongoDB] Connection attempt ${attempt}/3...`);
                await mongoose.connect(process.env.MONGO_URI, mongoOptions);
                await mongoose.connection.db.admin().ping();
                mongoConnected = true;
                console.log("✓ Connected to MongoDB");
                console.log("Database:", mongoose.connection.db.databaseName);
                console.log("Ready state:", mongoose.connection.readyState, "(1=connected)\n");
                break;
              } catch (mongoErr) {
                console.error(`[MongoDB] Attempt ${attempt} failed:`, mongoErr.message);
                if (attempt < 3) {
                  await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                } else {
                  throw mongoErr;
                }
              }
            }
            
            if (!mongoConnected) {
              throw new Error("Failed to connect to MongoDB after 3 attempts");
            }

    // Create dummy credential
    console.log("Creating test credential...");
    const credentialId = ethers.keccak256(ethers.toUtf8Bytes(`test-cred-${Date.now()}`));
    // Use deployer address as auditor (should be approved now)
    const testSubject = "0x1234567890123456789012345678901234567890"; // Dummy project address
    const testIssuer = deployInfo.deployer || "0x48E8750b87278227b5BBd53cae998e6083910bd9"; // Use deployer as auditor
    const summaryHash = ethers.keccak256(ethers.toUtf8Bytes("test-summary"));

    const credential = new Credential({
      credentialId,
      issuer: testIssuer,
      subject: testSubject,
      summaryHash,
      anchored: false
    });
    
            // Test the connection first
            try {
              await mongoose.connection.db.admin().ping();
              console.log("✓ MongoDB ping successful");
            } catch (pingErr) {
              console.error("✗ MongoDB ping failed:", pingErr.message);
              throw pingErr;
            }
            
            // Save credential with explicit write concern and timeout
            // Use direct MongoDB driver to avoid Mongoose buffering issues
            console.log("Saving credential to database (using direct MongoDB driver)...");
            const db = mongoose.connection.db;
            try {
              // Ensure connection is ready
              if (mongoose.connection.readyState !== 1) {
                console.log("[MongoDB] Waiting for connection to be ready...");
                await new Promise((resolve) => {
                  if (mongoose.connection.readyState === 1) {
                    resolve();
                  } else {
                    mongoose.connection.once('connected', resolve);
                    setTimeout(() => resolve(), 5000);
                  }
                });
              }
              
              const result = await db.collection('credentials').insertOne({
                credentialId,
                issuer: testIssuer,
                subject: testSubject,
                summaryHash,
                anchored: false,
                createdAt: new Date(),
                updatedAt: new Date()
              }, {
                writeConcern: { w: 'majority', wtimeout: 10000 },
                maxTimeMS: 30000
              });
              console.log(`✓ Created test credential: ${credentialId} (insertedId: ${result.insertedId})\n`);
            } catch (insertErr) {
              console.error("✗ Direct insert failed:", insertErr.message);
              throw insertErr;
            }

    // Step 0.5: Issue and anchor the credential on-chain
    console.log("🔗 Step 0.5: Issuing and anchoring credential on-chain...");
    try {
      const issueResult = await issueAndAnchorCredential(credentialId, testSubject, summaryHash, testIssuer);
      if (issueResult.alreadyDone) {
        console.log("✓ Credential already issued and anchored\n");
      } else {
        console.log(`✓ Credential issued and anchored successfully\n`);
      }
    } catch (issueErr) {
      console.error("⚠ Warning: Failed to issue/anchor credential:", issueErr.message);
      console.log("   Continuing with test (may fail if credential not anchored)...\n");
    }

    // Step 1: Generate proof
    console.log("📝 Step 1: Generating proof...");
    const genRes = await axios.post(`${BACKEND_URL}/api/proofs/generate`, {
      credentialId
    });
    console.log("GEN Response:", JSON.stringify(genRes.data, null, 2));
    
    if (!genRes.data.success || !genRes.data.proofId) {
      throw new Error("Proof generation failed");
    }
    const { proofId } = genRes.data;
    console.log(`✓ Proof generated: ${proofId}\n`);

    // Wait briefly
    console.log("⏳ Waiting 2 seconds...");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Verify proof
    console.log("✅ Step 2: Verifying proof on-chain...");
    const verRes = await axios.post(`${BACKEND_URL}/api/proofs/verify`, {
      proofId
    });
    console.log("VER Response:", JSON.stringify(verRes.data, null, 2));

    if (!verRes.data.success || !verRes.data.txnHash) {
      throw new Error("Proof verification failed");
    }
    const { txnHash } = verRes.data;
    console.log(`✓ Proof verified on-chain: ${txnHash}\n`);

            // Step 3: Fetch updated DB record with timeout
            console.log("📊 Step 3: Fetching updated DB record...");
            // Ensure connection is ready before querying
            if (mongoose.connection.readyState !== 1) {
              console.log("[MongoDB] Waiting for connection to be ready...");
              await new Promise((resolve) => {
                if (mongoose.connection.readyState === 1) {
                  resolve();
                } else {
                  mongoose.connection.once('connected', resolve);
                  setTimeout(() => resolve(), 5000);
                }
              });
            }
            
            // Use direct MongoDB driver query to avoid Mongoose buffering
            const db = mongoose.connection.db;
            const updatedRecord = await db.collection('proofrecords').findOne({ proofId }, { maxTimeMS: 30000 });
            if (!updatedRecord) {
              throw new Error("ProofRecord not found after verification");
            }
    console.log("DB Record:", JSON.stringify({
      proofId: updatedRecord.proofId,
      credentialId: updatedRecord.credentialId,
      project: updatedRecord.project,
      auditor: updatedRecord.auditor,
      validatedOnChain: updatedRecord.validatedOnChain,
      txnHash: updatedRecord.txnHash,
      createdAt: updatedRecord.createdAt,
      updatedAt: updatedRecord.updatedAt
    }, null, 2));
    console.log(`✓ Record updated: validatedOnChain=${updatedRecord.validatedOnChain}\n`);

    // Step 4: Print explorer URL
    const explorerLink = `${EXPLORER_URL}/tx/${txnHash}`;
    console.log("🔗 Explorer URL:", explorerLink);
    console.log(`\n✅ Integration test completed successfully!\n`);
    console.log("Summary:");
    console.log(`  - Proof ID: ${proofId}`);
    console.log(`  - Transaction Hash: ${txnHash}`);
    console.log(`  - Validated On-Chain: ${updatedRecord.validatedOnChain}`);
    console.log(`  - Explorer: ${explorerLink}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Integration test failed:", err.message);
    if (err.response?.data) {
      console.error("Response data:", JSON.stringify(err.response.data, null, 2));
    }
    if (err.stack) {
      console.error("Stack:", err.stack);
    }
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

run();


