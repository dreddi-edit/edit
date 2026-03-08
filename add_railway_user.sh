#!/bin/bash

# Add user to Railway deployment
RAILWAY_URL="https://edit-production-ca78.up.railway.app"

echo "Creating user on Railway deployment..."

# Register new user
curl -X POST "$RAILWAY_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@railway.com",
    "password": "test123456",
    "name": "Railway Test User"
  }'

echo -e "\n\nUser created: test@railway.com / test123456"
echo "Visit $RAILWAY_URL to login"
