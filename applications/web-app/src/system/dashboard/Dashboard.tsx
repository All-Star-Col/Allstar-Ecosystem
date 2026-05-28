import React from "react";
import { motion, AnimatePresence } from "motion/react";
// import { duration, easing } from "../../shared/animations";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { AppTitle } from "./components/AppTitle";
import { Header } from "./components/Header";
import { TabChips } from "./components/TabChips";
import { SearchBar } from "./components/SearchBar";
import { Footer } from "./components/Footer";
import { API_SERVER } from "../../config/api";

interface App {
  id: string;
  name: string;
  description: string | null;
  path: string;
  external_url: string | null;
  icon_key: string;
  icon_bg_color: string;
  badge_color: string;
}

interface WorkspaceResponse {
  apps: App[];
  username: string;
  full_name: string;
  role_code?: string | null;
  is_admin?: boolean;
  message: string;
}

// 1️⃣ Crear QueryClient (fuera del componente)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// 2️⃣ Hook useWorkspace (FUERA del componente App)
const useWorkspace = () => {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: async () => {
      const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token");
      const response = await fetch(`${API_SERVER}/workspace`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch workspace");
      }
      return response.json() as Promise<WorkspaceResponse>;
    },
  });
};

// 3️⃣ Componente Dashboard (separado)
function Dashboard() {
  const timeString = "09:05";
  const dateString = "VIERNES, 17 DE ABRIL DE 2026";

  const [selectedTab, setSelectedTab] = React.useState<string>("todas");

  const handleTabChange = (tab: string) => {
    setSelectedTab(tab);
  };
  const [searchQuery, setSearchQuery] = React.useState("");

  const { data: workspaceData } = useWorkspace();
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const [favorites, setFavorites] = React.useState<string[]>(() => {
    const saved = localStorage.getItem("favorite-apps");
    return saved ? JSON.parse(saved) : [];
  });

  const handleFavoriteToggle = (appId: string, isFavorited: boolean) => {
    setFavorites((prevFavorites) => {
      if (isFavorited) {
        return [...prevFavorites, appId];
      } else {
        return prevFavorites.filter((id) => id !== appId);
      }
    });
  };

  // Sync favorites with localStorage changes from other tabs/windows
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "favorite-apps") {
        setFavorites(e.newValue ? JSON.parse(e.newValue) : []);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const [recentApps, setRecentApps] = React.useState<
    { id: string; timestamp: number }[]
  >(() => {
    const saved = localStorage.getItem("recent-apps");
    return saved ? JSON.parse(saved) : [];
  });

  const handleAppAccess = (appId: string) => {
    const now = Date.now();
    const updated = recentApps.filter((app) => app.id !== appId);
    updated.push({ id: appId, timestamp: now });
    const limited = updated.slice(-20);
    setRecentApps(limited);
    localStorage.setItem("recent-apps", JSON.stringify(limited));
  };

  const filteredApps = React.useMemo(() => {
    const apps = workspaceData?.apps ?? [];

    let filtered = apps;
    if (normalizedSearchQuery) {
      filtered = apps.filter((app) =>
        app.name.toLowerCase().includes(normalizedSearchQuery),
      );
    }

    switch (selectedTab) {
      case "favorites":
        return filtered
          .filter((app) => favorites.includes(app.id))
          .sort((a, b) => a.name.localeCompare(b.name, "es"));
      case "recientes": {
        const recentAppIds = [...recentApps]
          .sort((a, b) => b.timestamp - a.timestamp)
          .map((app) => app.id);
        return filtered.filter((app) => recentAppIds.includes(app.id));
      }
      case "todas":
      default: {
        const favSet = new Set(favorites);
        return [...filtered].sort((a, b) => {
          const aFav = favSet.has(a.id);
          const bFav = favSet.has(b.id);
          if (aFav !== bFav) return aFav ? -1 : 1;
          return a.name.localeCompare(b.name, "es");
        });
      }
    }
  }, [
    workspaceData?.apps,
    normalizedSearchQuery,
    selectedTab,
    favorites,
    recentApps,
  ]);

  return (
    <div
      className="relative isolate min-h-screen w-full flex items-center justify-center
                    bg-[url('@/assets/bg.jpg')] bg-cover bg-center bg-no-repeat"
    >
      <div className="pointer-events-none fixed inset-0 z-0 bg-black/70 backdrop-blur-md" />

      <motion.div
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="relative z-10 flex flex-col w-[1200px] h-[650px] bg-background border border-border/10 rounded-2xl shadow-lg p-8"
      >
        <Header
          timeString={timeString}
          dateString={dateString}
          full_name={workspaceData?.full_name || "Usuario"}
          username={workspaceData?.username}
          isAdmin={workspaceData?.is_admin ?? false}
        />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex justify-between items-center mb-6"
        >
          <TabChips selectedTab={selectedTab} onTabChange={handleTabChange} />
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="grid gap-4 mb-6"
            style={{
              gridTemplateColumns: "repeat(6, 120px)",
              gridTemplateRows: "repeat(2, 92px)",
              justifyContent: "space-between",
            }}
          >
            <AnimatePresence>
              {filteredApps.map((app: App, index: number) => (
                <AppTitle
                  key={app.id}
                  id={app.id}
                  path={app.path}
                  name={app.name}
                  index={index}
                  iconBgColor={app.icon_bg_color || "#f6f5f0"}
                  badgeColor={app.badge_color}
                  icon={app.icon_key}
                  externalUrl={app.external_url}
                  onAccess={handleAppAccess}
                  onFavoriteToggle={handleFavoriteToggle}
                  isFavorited={favorites.includes(app.id)}
                  favoriteColor="#ffd700"
                  unfavoriteColor="#ccc"
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>

        <Footer />
      </motion.div>
    </div>
  );
}

// 4️⃣ Componente App con Provider
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
