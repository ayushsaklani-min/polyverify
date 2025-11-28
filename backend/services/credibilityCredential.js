/**
 * zkVerify — Polygon Amoy | Auditable Zero-Knowledge Verification Layer
 * 
 * Credibility Credential Service: Issues verifiable credibility credentials
 * to auditors upon approval via AIR Kit integration.
 */

const axios = require('axios');
const { randomUUID } = require('crypto');
class CredibilityCredentialService {
  constructor() {
    const partnerId = process.env.PARTNER_ID || process.env.NEXT_PUBLIC_PARTNER_ID;
    this.air3Client = axios.create({
      baseURL: process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'https://api.sandbox.air3.com',
      headers: {
        'x-partner-id': partnerId,
        'Content-Type': 'application/json'
      },
      // Avoid hanging requests to external API during demos
      timeout: 8000
    });
  }

  /**
   * Issue a credibility credential for an auditor
   * This proves the auditor's trustworthiness and qualifications
   */
  async issueCredibilityCredential(auditorAddress, auditorInfo, reputationData) {
    try {
      const credibilityScore = reputationData.credibilityScore || 0;
      
      // Calculate credibility level
      let credibilityLevel = 'New';
      if (credibilityScore >= 800) credibilityLevel = 'Elite';
      else if (credibilityScore >= 600) credibilityLevel = 'Expert';
      else if (credibilityScore >= 400) credibilityLevel = 'Experienced';
      else if (credibilityScore >= 200) credibilityLevel = 'Emerging';

      const partnerId = process.env.PARTNER_ID || process.env.NEXT_PUBLIC_PARTNER_ID;

      // REST API payload
      const payload = {
        partner_id: partnerId,
        issuer_did: process.env.ISSUER_DID || process.env.NEXT_PUBLIC_ISSUER_DID,
        subject_did: auditorAddress,
        verifier_did: process.env.VERIFIER_DID || process.env.NEXT_PUBLIC_VERIFIER_DID,
        credential_type: 'AuditorCredibility',
        logo_url: process.env.LOGO_URL || process.env.NEXT_PUBLIC_LOGO_URL,
        website_url: process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_WEBSITE_URL,
        status: 'Approved',
        metadata: {
          name: 'zkVerify Auditor Credibility Credential',
          issuer_address: process.env.ADMIN_ADDRESS || process.env.DEPLOYER_PRIVATE_KEY,
          credibility_score: credibilityScore,
          credibility_level: credibilityLevel,
          github_handle: auditorInfo.githubHandle || '',
          code4rena_handle: auditorInfo.code4renaHandle || '',
          immunefi_handle: auditorInfo.immunefiHandle || '',
          github_repos: reputationData.github?.count || 0,
          code4rena_findings: reputationData.code4rena?.count || 0,
          immunefi_bounties: reputationData.immunefi?.count || 0,
          approved_at: new Date(auditorInfo.approvedAt).toISOString()
        },
        jwks_url: process.env.JWKS_URL || process.env.NEXT_PUBLIC_JWKS_URL
      };

      // If fallback flag is enabled, skip remote call entirely to prevent hangs
      if (process.env.AIR3_FALLBACK_ON_ERROR === 'true') {
        console.log('📝 Using fallback mock credibility credential');
        return {
          success: true,
          credential: {
            credential_id: randomUUID(),
            issued_at: new Date().toISOString(),
            issuer_did: payload.issuer_did,
            subject_did: payload.subject_did,
            status: 'Approved',
            metadata: payload.metadata
          },
          credentialId: randomUUID()
        };
      }

      try {
        const response = await this.air3Client.post('/issuer/credentials', payload);
        return {
          success: true,
          credential: response.data,
          credentialId: response.data.credential_id || response.data.id
        };
      } catch (error) {
        // Fallback if AIR3 is unavailable
        if (!process.env.ISSUER_DID) {
          console.log('📝 Using fallback mock credibility credential');
          return {
            success: true,
            credential: {
              credential_id: randomUUID(),
              issued_at: new Date().toISOString(),
              issuer_did: payload.issuer_did,
              subject_did: payload.subject_did,
              status: 'Approved',
              metadata: payload.metadata
            },
            credentialId: randomUUID()
          };
        }
        throw error;
      }
    } catch (error) {
      console.error('Error issuing credibility credential:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get credibility credential for an auditor
   */
  async getCredibilityCredential(auditorAddress) {
    try {
      // In a real implementation, this would query a database or on-chain storage
      // For now, return null as credentials are issued on approval
      return null;
    } catch (error) {
      console.error('Error getting credibility credential:', error.message);
      return null;
    }
  }
}

module.exports = new CredibilityCredentialService();
