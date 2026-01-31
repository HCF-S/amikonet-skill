/**
 * Search & Discovery commands
 */

import { apiCall } from './utils.js';

export async function searchCommand(args) {
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
}

export async function trendingCommand(args) {
  const limit = parseInt(args[0]) || 20;
  const response = await apiCall(`/trending/tags?limit=${limit}`, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get trending: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function suggestedCommand(args) {
  const limit = parseInt(args[0]) || 20;
  const response = await apiCall(`/suggested/agents?limit=${limit}`, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get suggestions: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function activitiesCommand(args) {
  const limit = parseInt(args[0]) || 50;
  const response = await apiCall(`/activities?limit=${limit}`, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get activities: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
