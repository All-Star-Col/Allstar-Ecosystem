import React from "react";
import { motion } from "motion/react";
import {
    QueryClient,
    QueryClientProvider,
    useQuery,
} from "@tanstack/react-query";
import { AppTile } from "./components/AppTile";
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
    message: string;
}

// 1️⃣ Crear QueryClient (fuera del componente)
const queryClient = new QueryClient();

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
        staleTime: 5 * 60 * 1000, // 5 minutos fresh
        gcTime: 10 * 60 * 1000, // ⚠️ Era "cacheTime", ahora es "gcTime" en v5
    });
};

// handlePages

// 3️⃣ Componente Dashboard (separado)
function Dashboard() {
    const [currentDate, setCurrentDate] = React.useState(() => new Date());

    React.useEffect(() => {
        const intervalId = window.setInterval(() => {
            setCurrentDate(new Date());
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    const timeString = currentDate.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const dateString = currentDate.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    const [selectedTab, setSelectedTab] = React.useState("top-apps");
    const [searchQuery, setSearchQuery] = React.useState("");

    const { data: workspaceData } = useWorkspace();
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();

    const filteredApps = React.useMemo(() => {
        const apps = workspaceData?.apps ?? [];

        if (!normalizedSearchQuery) {
            return apps;
        }

        return apps.filter((app: App) =>
            app.name.toLowerCase().includes(normalizedSearchQuery),
        );
    }, [workspaceData?.apps, normalizedSearchQuery]);

    return (
        <div
            className="min-h-screen w-full flex items-center justify-center
                    bg-[url('@/assets/bg.jpg')] bg-cover bg-center bg-no-repeat"
        >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

            <motion.div
                initial={{ opacity: 0, scale: 0.75 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                className="relative flex flex-col"
                style={{
                    width: "1200px",
                    height: "650px",
                    backgroundColor: "#f6f5f0",
                    border: "1px solid rgba(47, 51, 57, 0.1)",
                    borderRadius: "24px",
                    boxShadow: "0 12px 30px 0 rgba(47, 51, 57, 0.12)",
                    padding: "32px",
                }}
            >
                <Header
                    timeString={timeString}
                    dateString={dateString}
                    name={workspaceData?.full_name}
                />

                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                    className="flex justify-between items-center mb-6"
                >
                    <TabChips
                        selectedTab={selectedTab}
                        onTabChange={setSelectedTab}
                    />
                    <SearchBar value={searchQuery} onChange={setSearchQuery} />
                </motion.div>

                <div
                    className="grid gap-4 mb-6"
                    style={{
                        gridTemplateColumns: "repeat(6, 120px)",
                        gridTemplateRows: "repeat(2, 92px)",
                        justifyContent: "space-between",
                    }}
                >
                    {filteredApps.map((app: App, index: number) => {
                        return (
                            <AppTile
                                key={app.id}
                                path={app.path}
                                name={app.name}
                                index={index}
                                iconBgColor={app.icon_bg_color || "#f6f5f0"}
                                badgeColor={app.badge_color}
                                icon={app.icon_key}
                            />
                        );
                    })}
                </div>

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
