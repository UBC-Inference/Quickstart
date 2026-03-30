python3 -m http.server 8000 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT SIGINT SIGTERM
wait $SERVER_PID
