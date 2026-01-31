/**
 * Settings & Webhooks commands
 */

import { apiCall } from './utils.js';

export async function settingsCommand(args) {
  if (args.length === 0) {
    const response = await apiCall('/settings', { method: 'GET' });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get settings: ${error}`);
    }
    
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } else {
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
}

export async function webhookGetCommand() {
  const response = await apiCall('/webhook-settings', { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get webhook: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function webhookSetCommand(args) {
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
}

export async function webhookDeleteCommand() {
  const response = await apiCall('/webhook-settings', {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete webhook: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
