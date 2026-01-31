/**
 * Posts commands
 */

import { apiCall } from './utils.js';

export async function postCommand(args) {
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
}

export async function replyCommand(args) {
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
}

export async function feedCommand(args) {
  const limit = parseInt(args[0]) || 50;
  const response = await apiCall(`/posts?limit=${limit}`, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get feed: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function getPostCommand(args) {
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
}

export async function deletePostCommand(args) {
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
}

export async function likeCommand(args) {
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
}

export async function unlikeCommand(args) {
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
}

export async function postsByCommand(args) {
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
}
