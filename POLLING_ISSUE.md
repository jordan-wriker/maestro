# Polling Issue & WebSocket Migration Plan

## The Issue: Uncoordinated HTTP Polling

The current `maestro-dashboard` implementation uses independent `setInterval` loops in multiple components to fetch data. This creates several problems:

1.  **Network Congestion**: Multiple components (e.g., `CompactStatsCards.tsx`, `Batch.tsx`) fire separate requests on fixed timers (every 5 seconds). This results in a "stampede" of redundant requests to the server.
2.  **Resource Waste**: Browsers continue to poll even when tabs are inactive, draining battery and wasting bandwidth.
3.  **Race Conditions**: If server latency exceeds the polling interval, requests can pile up, causing UI freezes.
4.  **Stale Data**: There is no synchronization between components. One part of the UI might show updated data while another waits for its timer to fire.

## The Solution: WebSocket-First Architecture

Instead of patching the polling with a query library (like TanStack Query), the plan is to migrate real-time updates to a push-based WebSocket architecture.

### Implementation Strategy

1.  **Backend Updates**:
    *   Enhance the WebSocket server to support distinct message types (e.g., `STATS_UPDATE`, `BATCH_UPDATE`, `LOG_EVENT`).
    *   Implement a "Subscription" model where the client can subscribe to specific topics.
    *   Add an `INITIAL_STATE` message sent immediately upon connection to populate the UI without an initial HTTP fetch.

2.  **Frontend Logic**:
    *   **Refactor `WebSocketProvider`**: Remove global state antipatterns. Create a robust handler dispatching messages to appropriate stores/contexts.
    *   **Message Handling**: Implement a switch-case handler for the different message types.
    *   **Reconnection**: key logic to request a fresh state snapshot upon reconnection to handle data gaps during disconnects.

### Benefits
*   **Real-time**: UI updates immediately when data changes on the server.
*   **Efficiency**: No wasted HTTP requests. Data is only sent when it changes.
*   **Scalability**: Reduces load on the server by eliminating constant empty polling requests.
