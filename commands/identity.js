/**
 * Identity Management commands
 */

import { apiCall } from './utils.js';

export async function identitiesCommand() {
  const response = await apiCall('/auth/identities', { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get identities: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function addIdentityCommand(args) {
  const did = args[0];
  const timestamp = args[1];
  const nonce = args[2];
  const signature = args[3];
  
  if (!did || !timestamp || !nonce || !signature) {
    console.error('Usage: amikonet add-identity <did> <timestamp> <nonce> <signature>');
    console.error('');
    console.error('To add a wallet identity, you need to sign a message with that wallet.');
    console.error('');
    console.error('=== Solana Wallet Example ===');
    console.error('');
    console.error('# 1. Get your wallet address');
    console.error('WALLET=$(solana address)');
    console.error('');
    console.error('# 2. Build the DID and message');
    console.error('DID="did:pkh:solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:$WALLET"');
    console.error('TIMESTAMP=$(date +%s)000');
    console.error('NONCE=$(openssl rand -hex 16)');
    console.error('MESSAGE="$DID:$TIMESTAMP:$NONCE"');
    console.error('');
    console.error('# 3. Sign the message with solana CLI');
    console.error('SIGNATURE=$(echo -n "$MESSAGE" | solana sign-offchain-message - 2>/dev/null | tail -1)');
    console.error('');
    console.error('# 4. Add the identity');
    console.error('amikonet add-identity "$DID" "$TIMESTAMP" "$NONCE" "$SIGNATURE"');
    console.error('');
    console.error('=== One-liner ===');
    console.error('');
    console.error('WALLET=$(solana address) && \\');
    console.error('DID="did:pkh:solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:$WALLET" && \\');
    console.error('TS=$(date +%s)000 && \\');
    console.error('NONCE=$(openssl rand -hex 16) && \\');
    console.error('SIG=$(echo -n "$DID:$TS:$NONCE" | solana sign-offchain-message - 2>/dev/null | tail -1) && \\');
    console.error('amikonet add-identity "$DID" "$TS" "$NONCE" "$SIG"');
    console.error('');
    console.error('=== EVM Wallet ===');
    console.error('DID format: did:pkh:eip155:1:<WALLET_ADDRESS>');
    console.error('Signature: hex-encoded ECDSA signature');
    process.exit(1);
  }
  
  const response = await apiCall('/auth/add', {
    method: 'POST',
    body: JSON.stringify({ did, timestamp: parseInt(timestamp), nonce, signature })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add identity: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
  console.error(`✅ Identity added: ${data.identity?.provider || 'unknown'}`);
}
