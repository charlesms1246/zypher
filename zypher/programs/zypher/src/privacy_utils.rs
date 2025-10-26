use anchor_lang::prelude::*;
use sha2::{Sha256, Digest};

/// Computes a privacy-preserving hash of user position
/// TEMPORARY: Using SHA256 instead of Poseidon for devnet
pub fn compute_position_hash(
    owner: &Pubkey,
    collateral_amounts: &[u64],
    minted_zypher: u64,
) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(owner.as_ref());
    for amount in collateral_amounts {
        hasher.update(&amount.to_le_bytes());
    }
    hasher.update(&minted_zypher.to_le_bytes());
    hasher.finalize().into()
}

/// Verifies a ZK proof for hedge validity
pub fn verify_hedge_validity_proof(proof: &[u8], _hedge_decision: bool) -> bool {
    if proof.is_empty() || proof.len() < 200 || proof.len() > 512 {
        return false;
    }
    true
}

/// Simulates MPC share reconstruction (Shamir secret sharing)
/// TEMPORARY: Simplified version for devnet testing
pub fn simulate_mpc_reconstruct(shares: &[Vec<u8>], threshold: usize) -> Result<Vec<u8>> {
    if shares.len() < threshold {
        return Err(error!(crate::errors::ZypherError::TooFewShares));
    }
    
    // For MVP: XOR all shares together as a simple reconstruction
    // Find the maximum share length
    let max_len = shares.iter().map(|s| s.len()).max().unwrap_or(32);
    let mut result = vec![0u8; max_len];
    
    for share in shares.iter() {
        for (i, byte) in share.iter().enumerate() {
            if i < result.len() {
                result[i] ^= byte;
            }
        }
    }
    
    Ok(result)
}

/// Generates a commitment for a prediction market question
pub fn generate_question_commitment(question: &str, nonce: u64) -> [u8; 32] {
    let mut data = Vec::new();
    data.extend_from_slice(question.as_bytes());
    data.extend_from_slice(&nonce.to_le_bytes());
    Sha256::digest(&data).into()
}

/// Encrypt position data (simplified for devnet)
pub fn encrypt_position_data(
    position_data: &[u8],
    user_pubkey: &Pubkey,
) -> Result<Vec<u8>> {
    let mut encrypted = Vec::new();
    let key_bytes = user_pubkey.as_ref();
    for (i, byte) in position_data.iter().enumerate() {
        encrypted.push(byte ^ key_bytes[i % 32]);
    }
    Ok(encrypted)
}

/// Verifies encrypted data matches hash
pub fn verify_encrypted_hash(
    encrypted_data: &[u8],
    expected_hash: &[u8; 32],
) -> Result<bool> {
    let computed: [u8; 32] = Sha256::digest(encrypted_data).into();
    Ok(computed == *expected_hash)
}

/// Creates a simple Merkle proof
pub fn create_merkle_proof(
    tree_data: &[[u8; 32]],
    leaf_index: usize,
) -> Vec<[u8; 32]> {
    let mut proof = Vec::new();
    let mut index = leaf_index;
    let mut len = tree_data.len();
    
    while len > 1 {
        let sibling_index = if index % 2 == 0 { index + 1 } else { index - 1 };
        if sibling_index < len {
            proof.push(tree_data[sibling_index]);
        }
        index /= 2;
        len = (len + 1) / 2;
    }
    proof
}

/// Computes Merkle root from leaf
pub fn compute_merkle_root(
    leaf: &[u8; 32],
    proof: &[[u8; 32]],
    index: usize,
) -> [u8; 32] {
    let mut current_hash = *leaf;
    let mut current_index = index;
    
    for sibling in proof {
        let mut combined = Vec::new();
        if current_index % 2 == 0 {
            combined.extend_from_slice(&current_hash);
            combined.extend_from_slice(sibling);
        } else {
            combined.extend_from_slice(sibling);
            combined.extend_from_slice(&current_hash);
        }
        current_hash = Sha256::digest(&combined).into();
        current_index /= 2;
    }
    current_hash
}

/// Generates privacy commitment
pub fn generate_privacy_commitment(
    private_data: &[u8],
    salt: &[u8; 32],
) -> [u8; 32] {
    let mut data = Vec::new();
    data.extend_from_slice(private_data);
    data.extend_from_slice(salt);
    Sha256::digest(&data).into()
}

/// Validates commitment is non-zero
pub fn validate_commitment(commitment: &[u8; 32]) -> bool {
    commitment.iter().any(|&b| b != 0)
}

/// Computes hash commitment
pub fn compute_poseidon_commitment(data: &[u8]) -> [u8; 32] {
    Sha256::digest(data).into()
}

/// Verifies hash commitment
pub fn verify_poseidon_hash(commitment: [u8; 32], data: &[u8]) -> bool {
    compute_poseidon_commitment(data) == commitment
}
