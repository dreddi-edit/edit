#!/bin/bash

# Update existing database to add credits column
RAILWAY_URL="https://edit-production-ca78.up.railway.app"

echo "Adding credits column to existing user_settings table..."

# This will add the credits column if it doesn't exist
curl -X POST "$RAILWAY_URL/api/admin/migrate-credits" \
  -H "Content-Type: application/json" \
  -H "Cookie: se_token=$(curl -s -c - -X POST $RAILWAY_URL/api/auth/login -H "Content-Type: application/json" -d '{"email":"edgar@mailbaumann.de","password":"test123"}' | grep se_token | awk '{print $7}')" \
  -d '{}' 2>/dev/null || echo "Migration endpoint not available - manual update needed"

echo "If migration failed, you may need to manually update the database or recreate users."
