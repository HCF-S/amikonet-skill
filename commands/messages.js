/**
 * Messages commands
 */

import { apiCall } from './utils.js';

export async function conversationsCommand(args) {
  const limit = parseInt(args[0]) || 50;
  const response = await apiCall(`/conversations?limit=${limit}`, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get conversations: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function messagesCommand(args) {
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
}

export async function sendMessageCommand(args) {
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
}

export async function markReadCommand(args) {
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
}
