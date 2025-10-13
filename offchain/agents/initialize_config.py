"""
Script to initialize the global config account for the Aegis Protocol.
This needs to be run once before the agent can start hedging.
"""
import json
import hashlib
import struct
from solana.rpc.api import Client
from solders.keypair import Keypair
from solders.transaction import Transaction
from solders.message import Message
from solders.instruction import Instruction, AccountMeta
from solders.pubkey import Pubkey
from solders.system_program import ID as SYS_PROGRAM_ID


def compute_anchor_discriminator(namespace, name):
    """Compute Anchor instruction discriminator using SHA256."""
    preimage = f"{namespace}:{name}"
    hash_result = hashlib.sha256(preimage.encode()).digest()
    return hash_result[:8]


def initialize_config():
    """Initialize the global config account."""
    # Load configuration
    with open('config.json', 'r') as f:
        config = json.load(f)
    
    # Load keypair
    keypair_path = config['wallet_keypair_path'].replace('~', '/home/aditya')
    with open(keypair_path, 'r') as f:
        keypair_data = json.load(f)
        keypair = Keypair.from_bytes(bytes(keypair_data))
    
    client = Client(config['rpc_url'])
    program_id = Pubkey.from_string(config['program_id'])
    admin_pubkey = keypair.pubkey()
    
    print(f"Program ID: {program_id}")
    print(f"Admin: {admin_pubkey}")
    
    # Derive config PDA
    config_seeds = [b"config"]
    config_pda, config_bump = Pubkey.find_program_address(config_seeds, program_id)
    print(f"Config PDA: {config_pda}")
    
    # Check if config already exists
    try:
        account_info = client.get_account_info(config_pda)
        if account_info.value is not None:
            print("Config account already initialized!")
            return
    except:
        pass
    
    # For this example, we'll use a dummy AEGIS mint and dummy collaterals
    # In production, you'd use real SPL token mints
    
    # Create a dummy mint pubkey (you should replace this with your actual AEGIS mint)
    # For now, we'll use the system program ID as a placeholder
    aegis_mint = Pubkey.from_string("So11111111111111111111111111111111111111112")  # Wrapped SOL mint
    
    # Approved collaterals (example: SOL)
    approved_collaterals = [
        Pubkey.from_string("So11111111111111111111111111111111111111112")  # Wrapped SOL
    ]
    
    # Oracle accounts (Pyth SOL/USD feed on devnet)
    oracle_accounts = [
        Pubkey.from_string("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix")  # Pyth SOL/USD devnet
    ]
    
    # Min collateral ratio: 150% = 150_000_000 (with 8 decimals)
    min_ratio = 150_000_000
    
    # Compute discriminator for initialize_config
    discriminator = compute_anchor_discriminator("global", "initialize_config")
    
    # Serialize instruction data
    # Format: discriminator (8) + min_ratio (u64 LE) + approved_collaterals (Vec<Pubkey>) + oracle_accounts (Vec<Pubkey>)
    data = bytearray()
    data.extend(discriminator)
    data.extend(struct.pack('<Q', min_ratio))
    
    # Serialize Vec<Pubkey> for approved_collaterals
    data.extend(struct.pack('<I', len(approved_collaterals)))  # length prefix
    for pubkey in approved_collaterals:
        data.extend(bytes(pubkey))
    
    # Serialize Vec<Pubkey> for oracle_accounts
    data.extend(struct.pack('<I', len(oracle_accounts)))  # length prefix
    for pubkey in oracle_accounts:
        data.extend(bytes(pubkey))
    
    # Create instruction accounts
    # pub struct InitializeConfig<'info> {
    #     pub config: Account<'info, GlobalConfig>,  // init
    #     pub admin: Signer<'info>,  // mut
    #     pub aegis_mint: Account<'info, Mint>,
    #     pub system_program: Program<'info, System>,
    # }
    accounts = [
        AccountMeta(pubkey=config_pda, is_signer=False, is_writable=True),
        AccountMeta(pubkey=admin_pubkey, is_signer=True, is_writable=True),
        AccountMeta(pubkey=aegis_mint, is_signer=False, is_writable=False),
        AccountMeta(pubkey=SYS_PROGRAM_ID, is_signer=False, is_writable=False),
    ]
    
    instruction = Instruction(
        program_id=program_id,
        data=bytes(data),
        accounts=accounts
    )
    
    # Get recent blockhash
    blockhash_resp = client.get_latest_blockhash()
    recent_blockhash = blockhash_resp.value.blockhash
    
    # Create and sign transaction
    message = Message.new_with_blockhash(
        [instruction],
        admin_pubkey,
        recent_blockhash
    )
    transaction = Transaction([keypair], message, recent_blockhash)
    
    # Send transaction
    print("Sending initialize_config transaction...")
    response = client.send_transaction(transaction)
    
    if hasattr(response, 'value'):
        tx_sig = str(response.value)
        print(f"✓ Config initialized successfully!")
        print(f"Transaction: {tx_sig}")
        print(f"View on explorer: https://explorer.solana.com/tx/{tx_sig}?cluster=devnet")
    else:
        print(f"✗ Transaction failed: {response}")


if __name__ == '__main__':
    initialize_config()
