import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConnectionStatus } from "@/components/ui/ConnectionStatus";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import Sessions from "@/pages/Sessions";
import Agents from "@/pages/Agents";
import Tools from "@/pages/Tools";
import Batch from "@/pages/Batch";
import Settings from "@/pages/Settings";

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <WebSocketProvider>
          <NotificationProvider>
            {/* Background glow effect */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 blur-[120px] rounded-full pointer-events-none z-0"></div>

            <ConnectionStatus />

            <div className="flex w-full h-full">
              <Sidebar />

              <main className="flex-1 overflow-hidden relative z-10 flex flex-col min-h-0">
                <div className="flex-1 min-h-0">
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/sessions" element={<Sessions />} />
                    <Route path="/logs" element={<Agents />} />
                    <Route path="/agents" element={<Agents />} />
                    <Route path="/tools" element={<Tools />} />
                    <Route path="/batch" element={<Batch />} />
                    <Route path="/settings" element={<Settings />} />
                    {/* Catch-all redirect to dashboard */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </div>
              </main>
            </div>
          </NotificationProvider>
        </WebSocketProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
