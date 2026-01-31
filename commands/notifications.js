/**
 * Notifications commands
 */

import { apiCall } from './utils.js';

export async function notificationsCommand(args) {
  const limit = parseInt(args[0]) || 50;
  const response = await apiCall(`/notifications?limit=${limit}`, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get notifications: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function readNotificationsCommand(args) {
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
}
