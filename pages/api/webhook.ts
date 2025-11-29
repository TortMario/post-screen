import type { NextApiRequest, NextApiResponse } from 'next';

// Configure max duration for Vercel
export const config = {
  maxDuration: 10, // Webhooks must respond within 10 seconds
};

/**
 * Webhook endpoint for Farcaster Mini App notifications
 * 
 * This endpoint receives events when users:
 * - Add the Mini App (miniapp_added)
 * - Remove the Mini App (miniapp_removed)
 * - Enable notifications (notifications_enabled)
 * - Disable notifications (notifications_disabled)
 * 
 * For now, this is a basic implementation that returns 200 OK.
 * To enable full notification functionality, you'll need to:
 * 1. Install @farcaster/miniapp-node: npm install @farcaster/miniapp-node
 * 2. Set NEYNAR_API_KEY in environment variables
 * 3. Implement verification and token storage
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const event = req.body;

    console.log('📬 Webhook event received:', {
      event: event.event,
      fid: event.fid,
      appFid: event.appFid,
      timestamp: new Date().toISOString(),
    });

    // Handle different event types
    switch (event.event) {
      case 'miniapp_added':
        console.log('✅ Mini App added by user:', event.fid);
        if (event.notificationDetails) {
          console.log('📱 Notifications enabled on add');
          // TODO: Save notification token and URL to database
          // await saveNotificationDetails(event.fid, event.appFid, event.notificationDetails);
        }
        break;

      case 'miniapp_removed':
        console.log('❌ Mini App removed by user:', event.fid);
        // TODO: Delete notification details from database
        // await deleteNotificationDetails(event.fid, event.appFid);
        break;

      case 'notifications_enabled':
        console.log('🔔 Notifications enabled for user:', event.fid);
        if (event.notificationDetails) {
          // TODO: Save notification token and URL to database
          // await saveNotificationDetails(event.fid, event.appFid, event.notificationDetails);
        }
        break;

      case 'notifications_disabled':
        console.log('🔕 Notifications disabled for user:', event.fid);
        // TODO: Delete notification details from database
        // await deleteNotificationDetails(event.fid, event.appFid);
        break;

      default:
        console.warn('⚠️ Unknown event type:', event.event);
    }

    // Return 200 OK immediately (Base app waits for response)
    // For Farcaster app, tokens are activated immediately
    return res.status(200).json({ 
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error: any) {
    console.error('❌ Webhook error:', error);
    // Still return 200 to avoid retries for malformed requests
    return res.status(200).json({ 
      success: false,
      error: error.message 
    });
  }
}

