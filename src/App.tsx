import { AppStateProvider } from "./store/appState";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <AppStateProvider>
      <AppRoutes />
    </AppStateProvider>
  );
}
