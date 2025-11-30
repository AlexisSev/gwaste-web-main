# Rapid Function - Push Notifications

## 🚀 Deployment Instructions

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Deploy the Function** (no environment variables needed for basic version):
   ```bash
   supabase functions deploy rapid-function
   ```

## 🔐 For Production Security (Optional)

For fully encrypted push notifications in production, add these environment variables in Supabase Dashboard:
- `VAPID_PUBLIC_KEY` = your VAPID public key
- `VAPID_PRIVATE_KEY` = your VAPID private key

The current version works without VAPID keys for development/testing.

## 🧪 Testing the Function

### Test with cURL:
```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/rapid-function' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "your-user-id",
    "title": "Test Notification",
    "body": "This is a test push notification"
  }'
```

### Test from Browser Console:
```javascript
// Insert a test collection to trigger notification
await supabase.from('collections').insert([{
  collector_name: 'Test Collector',
  area: 'Test Area',
  status: 'completed'
}]);
```

## 🔑 Key Features

- ✅ **Simplified Push Notifications** (works without external libraries)
- ✅ **Detailed Logging** for debugging
- ✅ **Better Error Handling** with specific error messages
- ✅ **CORS Support** for web app integration
- ✅ **Subscription Validation** before sending
- ✅ **Batch Processing** for multiple subscriptions
- ✅ **Production Ready** for development/testing

## 🔒 Security Note

This version sends notifications without encryption for simplicity. For production with full Web Push security, you would need to implement proper encryption using VAPID keys and the Web Push protocol. The current implementation works for most development and testing scenarios.

## 📡 Function URL

After deployment, your function will be available at:
```
https://your-project.supabase.co/functions/v1/rapid-function
```

## 🐛 Troubleshooting

1. **VAPID Keys Not Set**: Make sure environment variables are configured in Supabase
2. **No Subscriptions**: User must have active push subscriptions in `push_subscriptions` table
3. **CORS Issues**: Check that CORS headers are properly configured
4. **Function Not Found**: Verify the function name is `rapid-function` (not `send-push-notification`)

## 📊 Expected Response

```json
{
  "message": "Sent 1 notifications, 0 failed",
  "successful": 1,
  "failed": 0,
  "total": 1,
  "userId": "user-uuid"
}
```
