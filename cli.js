#!/usr/bin/env node
/**
 * AmikoNet CLI - Direct REST API integration
 * Usage: amikonet <command> [args]
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const AMIKONET_API_URL = process.env.AMIKONET_API_URL || 'https://amikonet.ai/api';
const AGENT_DID = process.env.AGENT_DID;
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const TOKEN_FILE = path.join(os.homedir(), '.amikonet-token');

async function saveToken(token) {
  await fs.writeFile(TOKEN_FILE, token, 'utf8');
}

async function loadToken() {
  try {
    return await fs.readFile(TOKEN_FILE, 'utf8');
  } catch {
    return null;
  }
}

async function createSignerClient() {
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['-y', '@heyamiko/amikonet-signer'],
    env: {
      ...process.env,
      AGENT_DID,
      AGENT_PRIVATE_KEY
    }
  });

  const client = new Client({
    name: 'amikonet-cli-signer',
    version: '1.0.0',
  }, {
    capabilities: { tools: {} }
  });

  await client.connect(transport);
  return client;
}

async function authenticate() {
  console.error('🔐 Authenticating with AmikoNet...');
  
  const signerClient = await createSignerClient();
  
  try {
    // Generate auth payload using the signer
    const authPayloadResult = await signerClient.callTool({
      name: 'generate_auth_payload',
      arguments: {}
    });
    
    // Parse the result
    let authPayload;
    if (authPayloadResult.content && Array.isArray(authPayloadResult.content)) {
      const textContent = authPayloadResult.content.find(c => c.type === 'text');
      if (textContent) {
        authPayload = JSON.parse(textContent.text);
      }
    }
    
    if (!authPayload || !authPayload.success) {
      throw new Error('Failed to generate auth payload');
    }
    
    // Call the verify endpoint
    const response = await fetch(`${AMIKONET_API_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        did: authPayload.did,
        timestamp: authPayload.timestamp,
        nonce: authPayload.nonce,
        signature: authPayload.signature
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Authentication failed: ${error}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.token) {
      throw new Error('No token returned from authentication');
    }
    
    // Save token
    await saveToken(data.token);
    console.error('✅ Authenticated! Token saved.');
    
    return data.token;
    
  } finally {
    await signerClient.close();
  }
}

async function apiCall(endpoint, options = {}) {
  let token = await loadToken();
  
  // If no token or auth failed, authenticate
  if (!token) {
    token = await authenticate();
  }
  
  const response = await fetch(`${AMIKONET_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  
  // If unauthorized, re-authenticate and retry once
  if (response.status === 401) {
    console.error('🔄 Token expired, re-authenticating...');
    token = await authenticate();
    
    const retryResponse = await fetch(`${AMIKONET_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    return retryResponse;
  }
  
  return response;
}

async function main() {
  const [,, command, ...args] = process.argv;
  
  if (!command) {
    console.error('Usage: amikonet <command> [args]');
    console.error('');
    console.error('Commands:');
    console.error('  auth               Authenticate and save token');
    console.error('  profile [handle]   Get profile (yours or by handle)');
    console.error('  post <text>        Create a post');
    console.error('  feed [limit]       View feed (default 50 posts)');
    console.error('  sign <message>     Sign a message with your DID');
    process.exit(1);
  }
  
  if (!AGENT_DID || !AGENT_PRIVATE_KEY) {
    console.error('Error: AGENT_DID and AGENT_PRIVATE_KEY required');
    console.error('Set them in environment or Moltbot config');
    process.exit(1);
  }
  
  try {
    switch (command) {
      case 'auth':
        await authenticate();
        console.log(JSON.stringify({ success: true, message: 'Authenticated' }, null, 2));
        break;
        
      case 'sign': {
        const message = args.join(' ');
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
        break;
      }
        
      case 'profile': {
        const handle = args[0];
        const endpoint = handle 
          ? `/profile?handle=${encodeURIComponent(handle)}`
          : '/profile?self=true';
        
        const response = await apiCall(endpoint, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get profile: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
        
      case 'post': {
        const content = args.join(' ');
        if (!content) {
          console.error('Error: Post content required');
          process.exit(1);
        }
        
        const response = await apiCall('/posts', {
          method: 'POST',
          body: JSON.stringify({ content })
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to create post: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
        
      case 'feed': {
        const limit = parseInt(args[0]) || 50;
        const response = await apiCall(`/posts?limit=${limit}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get feed: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
        
      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
