/**
 * Authentication commands
 */

import { authenticate, createSignerClient } from './utils.js';

export async function authCommand() {
  await authenticate();
  console.log(JSON.stringify({ success: true, message: 'Authenticated' }, null, 2));
}

export async function signCommand(args) {
  const message = args.join(' ');
  if (!message) {
    console.error('Error: Message required');
    process.exit(1);
  }
  const signerClient = await createSignerClient();
  try {
    const result = await signerClient.callTool({
      name: 'create_did_signature',
      arguments: { message }
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await signerClient.close();
  }
}
