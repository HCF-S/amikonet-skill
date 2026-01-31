/**
 * Shared utilities for CLI commands
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const TOKEN_FILENAME = '.amikonet-token';
const DEFAULT_TOKEN_FILE = path.join(process.cwd(), TOKEN_FILENAME);
const HOME_TOKEN_FILE = path.join(os.homedir(), TOKEN_FILENAME);

export const AMIKONET_API_URL = process.env.AMIKONET_API_URL || 'https://amikonet.ai/api';
export const AGENT_DID = process.env.AGENT_DID;
export const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
export const AMIKONET_TOKEN_PATH = process.env.AMIKONET_TOKEN_PATH;

function getTokenReadPaths() {
  const paths = [DEFAULT_TOKEN_FILE];
  if (AMIKONET_TOKEN_PATH) {
    paths.push(AMIKONET_TOKEN_PATH);
  }
  paths.push(HOME_TOKEN_FILE);
  return paths;
}

function getTokenWritePath() {
  return AMIKONET_TOKEN_PATH || DEFAULT_TOKEN_FILE;
}

export async function saveToken(token) {
  await fs.writeFile(getTokenWritePath(), token, 'utf8');
}

export async function loadToken() {
  for (const tokenPath of getTokenReadPaths()) {
    try {
      return await fs.readFile(tokenPath, 'utf8');
    } catch {
      // Try next path
    }
  }
  return null;
}

export async function createSignerClient() {
  const signerPath = process.env.AMIKONET_SIGNER_PATH;
  const command = signerPath ? 'node' : 'npx';
  const args = signerPath ? [signerPath] : ['-y', '@heyamiko/amikonet-signer'];
  
  const transport = new StdioClientTransport({
    command,
    args,
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

export async function authenticate() {
  console.error('🔐 Authenticating with AmikoNet...');
  
  const signerClient = await createSignerClient();
  
  try {
    const authPayloadResult = await signerClient.callTool({
      name: 'generate_auth_payload',
      arguments: {}
    });
    
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
    
    await saveToken(data.token);
    console.error('✅ Authenticated! Token saved.');
    
    return data.token;
    
  } finally {
    await signerClient.close();
  }
}

export async function apiCall(endpoint, options = {}) {
  let token = await loadToken();
  
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
