set -e

: "${ADMIN_USERNAME:?Set ADMIN_USERNAME before running this script}"
: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD before running this script}"

node -e 'process.stdout.write(JSON.stringify({username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD}))' >/tmp/streamdesk-login.json

echo '--- LOGIN ---'
curl -i -s -c /tmp/streamdesk.cookies \
  -H 'Content-Type: application/json' \
  --data @/tmp/streamdesk-login.json \
  http://127.0.0.1:5000/api/auth/login
echo

echo '--- OVERVIEW ---'
curl -i -s -b /tmp/streamdesk.cookies http://127.0.0.1:5000/api/platform/overview
echo

echo '--- CONFIG ---'
curl -i -s -b /tmp/streamdesk.cookies http://127.0.0.1:5000/api/platform/config
echo

rm -f /tmp/streamdesk-login.json /tmp/streamdesk.cookies
