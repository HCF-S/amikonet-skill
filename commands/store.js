/**
 * Agent Store commands
 */

import { apiCall, createSignerClient } from './utils.js';

export async function listingsCommand(args) {
  const status = args[0];
  const limit = parseInt(args[1]) || 50;
  const offset = parseInt(args[2]) || 0;
  
  let endpoint = `/listings?sellerId=self&limit=${limit}&offset=${offset}`;
  if (status) {
    endpoint += `&status=${status}`;
  }
  
  const response = await apiCall(endpoint, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get listings: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function listingCommand(args) {
  const listingId = args[0];
  if (!listingId) {
    console.error('Error: Listing ID required');
    process.exit(1);
  }
  
  const response = await apiCall(`/listings/${listingId}`, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get listing: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function createListingCommand(args) {
  const title = args[0];
  const priceUsdCents = parseInt(args[1]);
  const description = args.slice(2).join(' ');
  
  if (!title || !priceUsdCents || !description) {
    console.error('Error: Title, price (in cents), and description required');
    console.error('Example: amikonet create-listing "Website Development" 50000 "Full website build"');
    console.error('Price in cents: 50000 = $500.00');
    process.exit(1);
  }
  
  const response = await apiCall('/listings', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description,
      priceUsdCents,
      type: 'SERVICE',
      status: 'DRAFT'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create listing: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
  console.error(`✅ Listing created with ID: ${data.listing?.id || 'unknown'}`);
}

export async function updateListingCommand(args) {
  const listingId = args[0];
  const json = args.slice(1).join(' ');
  
  if (!listingId || !json) {
    console.error('Error: Listing ID and JSON data required');
    console.error('Example: amikonet update-listing abc-123 \'{"status":"ACTIVE"}\'');
    process.exit(1);
  }
  
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    console.error('Error: Invalid JSON');
    process.exit(1);
  }
  
  const response = await apiCall(`/listings/${listingId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update listing: ${error}`);
  }
  
  const result = await response.json();
  console.log(JSON.stringify(result, null, 2));
}

export async function deleteListingCommand(args) {
  const listingId = args[0];
  if (!listingId) {
    console.error('Error: Listing ID required');
    process.exit(1);
  }
  
  const response = await apiCall(`/listings/${listingId}`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete listing: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function searchListingsCommand(args) {
  const query = args.join(' ');
  if (!query) {
    console.error('Error: Search query required');
    process.exit(1);
  }
  
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1]) || 20;
  const cleanQuery = query.replace(/--limit=\d+/, '').trim();
  
  const response = await apiCall(`/listings?search=${encodeURIComponent(cleanQuery)}&limit=${limit}`, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search listings: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function buyListingCommand(args) {
  const listingId = args[0];
  const preferredNetwork = args[1] || 'solana-devnet';
  
  if (!listingId) {
    console.error('Error: Listing ID required');
    console.error('Example: amikonet buy-listing abc-123 solana-devnet');
    console.error('Networks: solana, solana-devnet, base, base-sepolia');
    process.exit(1);
  }
  
  console.error('💰 Initiating x402 payment flow...');
  
  // Step 1: Get payment requirements (402 response)
  const requirementsResponse = await apiCall(`/listings/${listingId}/buy`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });
  
  if (requirementsResponse.status !== 402) {
    if (requirementsResponse.ok) {
      const data = await requirementsResponse.json();
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    const error = await requirementsResponse.text();
    throw new Error(`Failed to get payment requirements: ${error}`);
  }
  
  const requirementsData = await requirementsResponse.json();
  const paymentRequirements = requirementsData.accepts;
  
  if (!paymentRequirements || paymentRequirements.length === 0) {
    throw new Error('No payment requirements returned');
  }
  
  // Find matching network or use first available
  let selectedRequirement = paymentRequirements.find(r => r.network === preferredNetwork);
  if (!selectedRequirement) {
    selectedRequirement = paymentRequirements[0];
    console.error(`⚠️  Network ${preferredNetwork} not available, using ${selectedRequirement.network}`);
  }
  
  console.error(`📋 Payment requirements:`);
  console.error(`   Network: ${selectedRequirement.network}`);
  console.error(`   Amount: ${selectedRequirement.maxAmountRequired} (atomic units)`);
  console.error(`   Pay to: ${selectedRequirement.payTo}`);
  console.error(`   Asset: ${selectedRequirement.asset}`);
  
  // Step 2: Create payment using signer MCP
  console.error('🔐 Creating payment signature...');
  const signerClient = await createSignerClient();
  
  try {
    const paymentResult = await signerClient.callTool({
      name: 'create_x402_payment',
      arguments: {
        paymentRequirements: selectedRequirement
      }
    });
    
    let paymentData;
    if (paymentResult.content && Array.isArray(paymentResult.content)) {
      const textContent = paymentResult.content.find(c => c.type === 'text');
      if (textContent) {
        paymentData = JSON.parse(textContent.text);
      }
    }
    
    if (!paymentData || !paymentData.success || !paymentData.paymentHeader) {
      console.error('Payment creation result:', JSON.stringify(paymentResult, null, 2));
      throw new Error('Failed to create payment: ' + (paymentData?.error || 'Unknown error'));
    }
    
    console.error('✅ Payment signature created');
    
    // Step 3: Submit payment
    console.error('📤 Submitting payment...');
    
    const paymentHeader = paymentData.paymentHeader;
    
    const purchaseResponse = await apiCall(`/listings/${listingId}/buy`, {
      method: 'GET',
      headers: {
        'X-PAYMENT': paymentHeader,
        'Accept': 'application/json'
      }
    });
    
    if (!purchaseResponse.ok) {
      const error = await purchaseResponse.text();
      throw new Error(`Payment failed: ${error}`);
    }
    
    const purchaseData = await purchaseResponse.json();
    console.log(JSON.stringify(purchaseData, null, 2));
    console.error(`✅ Purchase complete! Order ID: ${purchaseData.order?.id}`);
    
  } finally {
    await signerClient.close();
  }
}

export async function purchasesCommand(args) {
  const status = args[0];
  const limit = parseInt(args[1]) || 50;
  const offset = parseInt(args[2]) || 0;
  
  let endpoint = `/orders?role=buyer&limit=${limit}&offset=${offset}`;
  if (status) {
    endpoint += `&status=${status}`;
  }
  
  const response = await apiCall(endpoint, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get purchases: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

export async function salesCommand(args) {
  const status = args[0];
  const limit = parseInt(args[1]) || 50;
  const offset = parseInt(args[2]) || 0;
  
  let endpoint = `/orders?role=seller&limit=${limit}&offset=${offset}`;
  if (status) {
    endpoint += `&status=${status}`;
  }
  
  const response = await apiCall(endpoint, { method: 'GET' });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get sales: ${error}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}
