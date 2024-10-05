#!/bin/sh

# Use the EXPO_PORT environment variable if set, otherwise set to 443
if [ -z "$EXPO_PORT" ]; then
  EXPO_PORT=8800
fi

# Check if GitHub credentials are set
if [ -z "$GITHUB_USERNAME" ] || [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_USERNAME and GITHUB_TOKEN must be set. Exiting"
  exit 1
fi

# check if DISCOVERY_SERVICE_URL is set
if [ -z "$DISCOVERY_SERVICE_URL" ]; then
  echo "ERROR: DISCOVERY_SERVICE_URL is not set. Exiting"
  exit 1
fi

# check if HOSTNAME is set
if [ -z "$HOSTNAME" ]; then
  echo "ERROR: HOSTNAME is not set. Exiting"
  exit 1
fi

# check if INSTANCE_ID is set
if [ -z "$INSTANCE_ID" ]; then
  echo "ERROR: INSTANCE_ID is not set. Exiting"
  exit 1
fi

# check if INSTANCE_HOSTNAME is set
if [ -z "$INSTANCE_HOSTNAME" ]; then
  echo "ERROR: INSTANCE_HOSTNAME is not set. Exiting"
  exit 1
fi

# Initialize git repo if not already initialized
if [ ! -d ".git" ]; then
  echo "Initializing git repository"
  git init
  git config --global user.name "$GITHUB_USERNAME"
  git config --global user.email "$GITHUB_USERNAME@users.noreply.github.com"
  
  # Create a new repository under 'apply-apps' organization using GitHub API
  echo "Creating repository on GitHub"
  curl -u "$GITHUB_USERNAME:$GITHUB_TOKEN" https://api.github.com/orgs/apply-apps/repos -d '{"name":"'$HOSTNAME'", "private":false}' || {
    echo "ERROR: Failed to create repository"
  }

  git remote add origin https://$GITHUB_USERNAME:$GITHUB_TOKEN@github.com/apply-apps/$HOSTNAME.git
  git add .
  git commit -m "Initial commit"
  git push -u origin master
fi

# Function to send registration request every minute
send_registration() {
  while true; do
    response=$(curl -s --max-time 5 --connect-timeout 5 -X POST "$DISCOVERY_SERVICE_URL/register" \
              -H "Content-Type: application/json" \
              -d '{
                    "id": "'"$HOSTNAME"'",
                    "hostname": "'"$INSTANCE_HOSTNAME"'",
                    "hostInstanceId": "'"$INSTANCE_ID"'"
                  }')
    if [ -n "$response" ]; then
      echo "$(date) - RESPONSE: $response"
    else
      echo "$(date) - ERROR: Registration request to $DISCOVERY_SERVICE_URL failed"
    fi
    sleep 25
  done
}

# Start the registration loop in the background
send_registration &

# Copy initial index.js to App directory
echo "$(date) - Copying /app/image/index.js to /app/App/index.js"
cp /app/image/index.js /app/App/index.js

# Start the application
start_application() {
  echo "$(date) - Starting the application on port $EXPO_PORT"
  npm start -- --reset-cache --port $EXPO_PORT &
  APP_PID=$!
  echo "$(date) - Application started with PID $APP_PID"
}

stop_application() {
  echo "$(date) - Stopping the application"
  pkill -f "node /app/node_modules/.bin/expo start --reset-cache --port $EXPO_PORT"
  echo "$(date) - Application stopped"
}

rebuild_application() {
  echo "$(date) - Rebuilding the application..."
  cp /app/image/index.js /app/App/index.js
  stop_application
  start_application
  echo "$(date) - Application rebuilt and started"
}

# Ensure directory and rebuild flag file exist
mkdir -p /app
touch /app/rebuild_flag

# Start the application initially
start_application

# Watch for changes to trigger rebuild
inotifywait -m -e create,modify,delete /app |
while read -r directory events filename; do
  if [ "$filename" = "rebuild_flag" ]; then
    rebuild_application
  fi
done
