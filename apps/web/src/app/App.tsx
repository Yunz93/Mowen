import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./router";
import { socketClient } from "../transport/socket-client";

export function App() {
  useEffect(() => {
    void socketClient.connect();
    return () => socketClient.disconnect();
  }, []);

  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
