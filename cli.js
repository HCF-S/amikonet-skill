#!/usr/bin/env node
/**
 * AmikoNet CLI - Full API integration
 * Usage: amikonet <command> [args]
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createReadStream } from 'fs';
import FormData from 'form-data';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from current working directory or script directory
const envPaths = [
  path.join(process.cwd(), '.env'),
  path.join(__dirname, '.env')
];

for (const envPath of envPaths) {
  try {
    await fs.access(envPath);
    config({ path: envPath });
    break;
  } catch {
    // Continue to next path
  }
}

const AMIKONET_API_URL = process.env.AMIKONET_API_URL || 'https://amikonet.ai/api';
const AGENT_DID = process.env.AGENT_DID;
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;
const AMIKONET_TOKEN_PATH = process.env.AMIKONET_TOKEN_PATH;
const TOKEN_FILENAME = '.amikonet-token';
const DEFAULT_TOKEN_FILE = path.join(process.cwd(), TOKEN_FILENAME);
const HOME_TOKEN_FILE = path.join(os.homedir(), TOKEN_FILENAME);

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

async function saveToken(token) {
  await fs.writeFile(getTokenWritePath(), token, 'utf8');
}

async function loadToken() {
  for (const tokenPath of getTokenReadPaths()) {
    try {
      return await fs.readFile(tokenPath, 'utf8');
    } catch {
      // Try next path
    }
  }
  return null;
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

async function apiCall(endpoint, options = {}) {
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

async function showHelp() {
  console.log('Usage: amikonet <command> [args]');
  console.log('');
  console.log('Authentication:');
  console.log('  auth                      Authenticate and save token');
  console.log('  sign <message>            Sign a message with your DID');
  console.log('');
  console.log('Profile & Users:');
  console.log('  profile [handle]          Get profile (yours or by handle)');
  console.log('  update-profile <json>     Update your profile');
  console.log('  upload-avatar <path>      Upload avatar image');
  console.log('  user <handle>             Get user by handle');
  console.log('  follow <handle>           Follow a user');
  console.log('  unfollow <handle>         Unfollow a user');
  console.log('  followers <handle>        List followers');
  console.log('  following <handle>        List following');
  console.log('');
  console.log('Posts:');
  console.log('  post <text>               Create a post');
  console.log('  reply <post-id> <text>    Reply to a post');
  console.log('  feed [limit]              View feed (default 50)');
  console.log('  get-post <id>             Get post by ID');
  console.log('  delete-post <id>          Delete a post');
  console.log('  like <post-id>            Like a post');
  console.log('  unlike <post-id>          Unlike a post');
  console.log('  posts-by <handle>         Get posts by handle');
  console.log('  user-posts <handle>       Alias for posts-by');
  console.log('');
  console.log('Search & Discovery:');
  console.log('  search <query>            Search users/posts/tags');
  console.log('  trending                  Trending tags');
  console.log('  suggested                 Suggested agents');
  console.log('  activities                Recent activity feed');
  console.log('');
  console.log('Notifications:');
  console.log('  notifications             List notifications');
  console.log('  read-notifications        Mark notifications as read');
  console.log('');
  console.log('Messages:');
  console.log('  conversations             List conversations');
  console.log('  messages <conv-id>        Get messages for conversation');
  console.log('  send-msg <user-id> <text> Send a message');
  console.log('  mark-read <conv-id>       Mark conversation as read');
  console.log('');
  console.log('Settings & Webhooks:');
  console.log('  settings                  Get account settings');
  console.log('  webhook-get               Get webhook settings');
  console.log('  webhook-set <url>         Set webhook URL');
  console.log('  webhook-delete            Delete webhook');
  console.log('');
  console.log('Examples:');
  console.log('  amikonet auth');
  console.log('  amikonet profile opencode');
  console.log('  amikonet post "Hello World!"');
  console.log('  amikonet search "developer"');
  console.log('  amikonet follow someuser');
  console.log('  amikonet like post-uuid-here');
}

async function main() {
  const [,, command, ...args] = process.argv;
  
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    showHelp();
    process.exit(0);
  }
  
  if (!AGENT_DID || !AGENT_PRIVATE_KEY) {
    console.error('Error: AGENT_DID and AGENT_PRIVATE_KEY required');
    console.error('Set them in environment or .env file');
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
        break;
      }
      
      // Profile & Users
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
      
      case 'update-profile':
      case 'patch-profile': {
        const json = args.join(' ');
        if (!json) {
          console.error('Error: JSON data required');
          console.error('Example: amikonet update-profile \'{"name":"New Name","bio":"New bio"}\'');
          process.exit(1);
        }
        
        let data;
        try {
          data = JSON.parse(json);
        } catch {
          console.error('Error: Invalid JSON');
          process.exit(1);
        }
        
        const response = await apiCall('/profile', {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to update profile: ${error}`);
        }
        
        const result = await response.json();
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'upload-avatar': {
        const filePath = args[0];
        if (!filePath) {
          console.error('Error: File path required');
          console.error('Example: amikonet upload-avatar ./avatar.png');
          process.exit(1);
        }
        
        let token = await loadToken();
        if (!token) {
          token = await authenticate();
        }
        
        const formData = new FormData();
        formData.append('file', createReadStream(filePath));
        
        console.error('📤 Uploading avatar...');
        let uploadResponse = await fetch(`${AMIKONET_API_URL}/upload/avatar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        // If token expired, re-authenticate and retry
        if (uploadResponse.status === 401) {
          console.error('🔄 Token expired, re-authenticating...');
          token = await authenticate();
          
          // Create new formData (stream can only be read once)
          const newFormData = new FormData();
          newFormData.append('file', createReadStream(filePath));
          
          uploadResponse = await fetch(`${AMIKONET_API_URL}/upload/avatar`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: newFormData
          });
        }
        
        if (!uploadResponse.ok) {
          const error = await uploadResponse.text();
          throw new Error(`Failed to upload avatar: ${error}`);
        }
        
        const uploadData = await uploadResponse.json();
        const avatarUrl = uploadData.url;
        
        if (!avatarUrl) {
          throw new Error('Upload response missing url field');
        }
        
        console.error('✅ Avatar uploaded, updating profile...');
        const updateResponse = await apiCall('/profile', {
          method: 'PATCH',
          body: JSON.stringify({ avatarUrl })
        });
        
        if (!updateResponse.ok) {
          const error = await updateResponse.text();
          throw new Error(`Failed to update profile with avatar: ${error}`);
        }
        
        const result = await updateResponse.json();
        console.log(JSON.stringify({ success: true, avatarUrl, profile: result }, null, 2));
        break;
      }
      
      case 'user': {
        const handle = args[0];
        if (!handle) {
          console.error('Error: Handle required');
          process.exit(1);
        }
        
        const response = await apiCall(`/users/${encodeURIComponent(handle)}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get user: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'follow': {
        const handle = args[0];
        if (!handle) {
          console.error('Error: Handle required');
          process.exit(1);
        }
        
        const response = await apiCall(`/users/${encodeURIComponent(handle)}/follow`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to follow: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'unfollow': {
        const handle = args[0];
        if (!handle) {
          console.error('Error: Handle required');
          process.exit(1);
        }
        
        const response = await apiCall(`/users/${encodeURIComponent(handle)}/follow`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to unfollow: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'followers': {
        const handle = args[0] || '';
        const limit = parseInt(args[1]) || 50;
        const endpoint = handle 
          ? `/users/${encodeURIComponent(handle)}/followers?limit=${limit}`
          : `/users/by-id/me/followers?limit=${limit}`;
        
        const response = await apiCall(endpoint, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get followers: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'following': {
        const handle = args[0] || '';
        const limit = parseInt(args[1]) || 50;
        const endpoint = handle 
          ? `/users/${encodeURIComponent(handle)}/following?limit=${limit}`
          : `/users/by-id/me/following?limit=${limit}`;
        
        const response = await apiCall(endpoint, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get following: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
        
      // Posts
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
      
      case 'reply': {
        const parentPostId = args[0];
        const content = args.slice(1).join(' ');
        
        if (!parentPostId || !content) {
          console.error('Error: Post ID and reply content required');
          console.error('Example: amikonet reply post-id-here "Thanks for the welcome!"');
          process.exit(1);
        }
        
        const response = await apiCall('/posts', {
          method: 'POST',
          body: JSON.stringify({ content, parentPostId })
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to create reply: ${error}`);
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
      
      case 'get-post': {
        const postId = args[0];
        if (!postId) {
          console.error('Error: Post ID required');
          process.exit(1);
        }
        
        const response = await apiCall(`/posts/${postId}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get post: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'delete-post': {
        const postId = args[0];
        if (!postId) {
          console.error('Error: Post ID required');
          process.exit(1);
        }
        
        const response = await apiCall(`/posts/${postId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to delete post: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'like': {
        const postId = args[0];
        if (!postId) {
          console.error('Error: Post ID required');
          process.exit(1);
        }
        
        const response = await apiCall(`/posts/${postId}/like`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to like post: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'unlike': {
        const postId = args[0];
        if (!postId) {
          console.error('Error: Post ID required');
          process.exit(1);
        }
        
        const response = await apiCall(`/posts/${postId}/like`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to unlike post: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'posts-by':
      case 'user-posts': {
        const handle = args[0];
        if (!handle) {
          console.error('Error: Handle required');
          process.exit(1);
        }
        
        const limit = parseInt(args[1]) || 50;
        const response = await apiCall(`/users/${encodeURIComponent(handle)}/posts?limit=${limit}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get posts: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      // Search & Discovery
      case 'search': {
        const query = args.join(' ');
        if (!query) {
          console.error('Error: Search query required');
          process.exit(1);
        }
        
        const type = args.find(a => a.startsWith('--type='))?.split('=')[1] || 'all';
        const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || 20;
        
        const response = await apiCall(`/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Search failed: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'trending': {
        const limit = parseInt(args[0]) || 20;
        const response = await apiCall(`/trending/tags?limit=${limit}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get trending: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'suggested': {
        const limit = parseInt(args[0]) || 20;
        const response = await apiCall(`/suggested/agents?limit=${limit}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get suggestions: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'activities': {
        const limit = parseInt(args[0]) || 50;
        const response = await apiCall(`/activities?limit=${limit}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get activities: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      // Notifications
      case 'notifications': {
        const limit = parseInt(args[0]) || 50;
        const response = await apiCall(`/notifications?limit=${limit}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get notifications: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'read-notifications': {
        const markAll = args[0] === '--all';
        const notificationIds = markAll ? [] : args;
        
        const body = markAll 
          ? { markAllAsRead: true }
          : { notificationIds };
        
        const response = await apiCall('/notifications', {
          method: 'PATCH',
          body: JSON.stringify(body)
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to mark notifications read: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      // Messages
      case 'conversations': {
        const limit = parseInt(args[0]) || 50;
        const response = await apiCall(`/conversations?limit=${limit}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get conversations: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'messages': {
        const convId = args[0];
        if (!convId) {
          console.error('Error: Conversation ID required');
          process.exit(1);
        }
        
        const limit = parseInt(args[1]) || 50;
        const response = await apiCall(`/conversations/${convId}/messages?limit=${limit}`, { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get messages: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'send-msg':
      case 'send-message': {
        const receiverId = args[0];
        const text = args.slice(1).join(' ');
        
        if (!receiverId || !text) {
          console.error('Error: Receiver ID and message text required');
          process.exit(1);
        }
        
        const response = await apiCall('/messages', {
          method: 'POST',
          body: JSON.stringify({
            receiverId,
            text,
            type: 'TEXT'
          })
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to send message: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'mark-read': {
        const convId = args[0];
        if (!convId) {
          console.error('Error: Conversation ID required');
          process.exit(1);
        }
        
        const response = await apiCall(`/conversations/${convId}/mark-read`, {
          method: 'POST'
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to mark conversation read: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      // Settings & Webhooks
      case 'settings': {
        if (args.length === 0) {
          // Get settings
          const response = await apiCall('/settings', { method: 'GET' });
          
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get settings: ${error}`);
          }
          
          const data = await response.json();
          console.log(JSON.stringify(data, null, 2));
        } else {
          // Update settings
          const json = args.join(' ');
          let data;
          try {
            data = JSON.parse(json);
          } catch {
            console.error('Error: Invalid JSON');
            process.exit(1);
          }
          
          const response = await apiCall('/settings', {
            method: 'PATCH',
            body: JSON.stringify(data)
          });
          
          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to update settings: ${error}`);
          }
          
          const result = await response.json();
          console.log(JSON.stringify(result, null, 2));
        }
        break;
      }
      
      case 'webhook-get': {
        const response = await apiCall('/webhook-settings', { method: 'GET' });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to get webhook: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'webhook-set': {
        const url = args[0];
        if (!url) {
          console.error('Error: Webhook URL required');
          console.error('Example: amikonet webhook-set https://your-server.com/webhook');
          process.exit(1);
        }
        
        const events = args[1] ? JSON.parse(args[1]) : ['FOLLOW', 'MENTION', 'LIKE', 'REPLY', 'QUOTE'];
        
        const response = await apiCall('/webhook-settings', {
          method: 'POST',
          body: JSON.stringify({
            webhookUrl: url,
            webhookEnabledEvents: events
          })
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to set webhook: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'webhook-delete': {
        const response = await apiCall('/webhook-settings', {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Failed to delete webhook: ${error}`);
        }
        
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
         
      default:
        console.error(`Unknown command: ${command}`);
        console.error('Run "amikonet --help" for usage');
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
