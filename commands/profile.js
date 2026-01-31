/**
 * Profile & User commands
 */

import { createReadStream } from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { apiCall, authenticate, loadToken, AMIKONET_API_URL } from './utils.js';

export async function profileCommand(args) {
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
}

export async function updateProfileCommand(args) {
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
}

export async function uploadAvatarCommand(args) {
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
  
  if (uploadResponse.status === 401) {
    console.error('🔄 Token expired, re-authenticating...');
    token = await authenticate();
    
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
}

export async function userCommand(args) {
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
}

export async function followCommand(args) {
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
}

export async function unfollowCommand(args) {
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
}

export async function followersCommand(args) {
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
}

export async function followingCommand(args) {
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
}
