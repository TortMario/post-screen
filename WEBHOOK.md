# Webhook Setup

## Current Implementation

A basic webhook endpoint has been created at `/api/webhook` that:
- ✅ Accepts POST requests from Farcaster/Base clients
- ✅ Returns 200 OK within 10 seconds (required by Base app)
- ✅ Logs all webhook events for debugging
- ✅ Handles all event types: `miniapp_added`, `miniapp_removed`, `notifications_enabled`, `notifications_disabled`

## Manifest Configuration

The `webhookUrl` has been added to the manifest:
```json
{
  "webhookUrl": "https://post-screen.vercel.app/api/webhook"
}
```

## Event Types

The webhook receives the following events:

1. **`miniapp_added`** - When a user adds the Mini App
   - May include `notificationDetails` with `token` and `url` if notifications are enabled

2. **`miniapp_removed`** - When a user removes the Mini App
   - All notification tokens for this user should be invalidated

3. **`notifications_enabled`** - When a user enables notifications
   - Includes `notificationDetails` with new `token` and `url`

4. **`notifications_disabled`** - When a user disables notifications
   - Notification tokens should be invalidated

## Future Enhancements

To enable full notification functionality:

1. **Install dependencies:**
   ```bash
   npm install @farcaster/miniapp-node
   ```

2. **Set environment variable:**
   ```env
   NEYNAR_API_KEY=your_neynar_api_key
   ```
   Get a free API key from [neynar.com](https://dev.neynar.com/)

3. **Implement verification:**
   - Use `parseWebhookEvent` and `verifyAppKeyWithNeynar` to verify webhook signatures
   - This ensures events are authentic and from trusted sources

4. **Store notification tokens:**
   - Save `notificationDetails.token` and `notificationDetails.url` to a database
   - Use both `fid` and `appFid` together as a unique identifier
   - Delete tokens when `miniapp_removed` or `notifications_disabled` events are received

5. **Send notifications:**
   - Make POST requests to the stored `url` with the `token`
   - See the notification sending example in the Base documentation

## Testing

After deployment, test the webhook:
```bash
curl -X POST https://post-screen.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"event": "miniapp_added", "fid": 12345, "appFid": 309857}'
```

Expected response: `{"success": true, "message": "Webhook processed successfully"}`

## Notes

- Webhooks must respond within 10 seconds (Base app requirement)
- Farcaster app activates tokens immediately, Base app waits for webhook response
- Each client app (Farcaster, Base) has separate notification preferences
- Notification tokens are unique per (user, client app, Mini App) combination

