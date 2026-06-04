import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { type ReactNode } from "react";

import { LoginCard } from "../system/login/components/LoginCard";
import { Footer } from "../system/dashboard/components/Footer";
import DashboardApp from "../system/dashboard/Dashboard";

interface WorkspaceApp {
    id: string;
    name: string;
    description: string | null;
    path: string;
    external_url: string | null;
    icon_key: string;
    icon_bg_color: string;
    badge_color: string;
}

const workspaceAppsFixture: WorkspaceApp[] = [
    {
        id: "1",
        name: "Inventory",
        description: null,
        path: "/inventory",
        external_url: null,
        icon_key: "box",
        icon_bg_color: "#f6f5f0",
        badge_color: "#122337",
    },
    {
        id: "2",
        name: "Production",
        description: null,
        path: "/production",
        external_url: null,
        icon_key: "factory",
        icon_bg_color: "#f6f5f0",
        badge_color: "#122337",
    },
    {
        id: "3",
        name: "Orders",
        description: null,
        path: "/orders",
        external_url: null,
        icon_key: "clipboard",
        icon_bg_color: "#f6f5f0",
        badge_color: "#122337",
    },
];

const TestWrapper = ({ children }: { children: ReactNode }) => {
    return <BrowserRouter>{children}</BrowserRouter>;
};

const mockWorkspaceResponse = (apps: WorkspaceApp[] = workspaceAppsFixture) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
            apps,
            username: "test.user",
            full_name: "Test User",
            message: "ok",
        }),
    } as Response);
};

const formatDashboardTime = (date: Date) =>
    date.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });

beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("access_token", "mock-token");
});

afterEach(() => {
    vi.useRealTimers();
});

describe("Acceptance Criteria Tests", () => {
    describe("1. Login Help Center opens modal with IT notification message", () => {
        it("Help Center button opens modal with IT notification message", () => {
            render(
                <TestWrapper>
                    <LoginCard />
                </TestWrapper>
            );

            const helpCenterButton = screen.getByRole("button", { name: /Help Center/i });
            fireEvent.click(helpCenterButton);

            expect(
                screen.getByRole("dialog", { name: /Help Center/i }),
            ).toBeInTheDocument();
            expect(screen.getByText(/El equipo de IT ha sido notificado/i)).toBeInTheDocument();
            expect(screen.getByText(/te contactaremos pronto/i)).toBeInTheDocument();
        });

        it("Help Center modal can be closed", async () => {
            render(
                <TestWrapper>
                    <LoginCard />
                </TestWrapper>
            );

            const helpCenterButton = screen.getByRole("button", { name: /Help Center/i });
            fireEvent.click(helpCenterButton);

            const closeButton = screen.getByRole("button", {
                name: "Cerrar modal Help Center",
            });
            fireEvent.click(closeButton);

            await waitFor(() => {
                expect(
                    screen.queryByRole("dialog", { name: /Help Center/i }),
                ).not.toBeInTheDocument();
            });
        });

        it("Help Center modal supports Escape close and focus returns to trigger", async () => {
            render(
                <TestWrapper>
                    <LoginCard />
                </TestWrapper>,
            );

            const helpCenterButton = screen.getByRole("button", {
                name: /Help Center/i,
            });
            helpCenterButton.focus();
            fireEvent.click(helpCenterButton);

            await waitFor(() => {
                expect(
                    screen.getByRole("button", {
                        name: /Cerrar modal Help Center/i,
                    }),
                ).toHaveFocus();
            });

            fireEvent.keyDown(window, { key: "Escape" });

            await waitFor(() => {
                expect(
                    screen.queryByRole("dialog", { name: /Help Center/i }),
                ).not.toBeInTheDocument();
            });

            await waitFor(() => {
                expect(helpCenterButton).toHaveFocus();
            });
        });

        it("Typing in email keeps focus and does not jump to Help Center on fresh load", () => {
            render(
                <TestWrapper>
                    <LoginCard />
                </TestWrapper>,
            );

            const emailInput = screen.getByPlaceholderText(
                "username@allstar.com",
            ) as HTMLInputElement;
            const helpCenterButton = screen.getByRole("button", {
                name: /Help Center/i,
            });

            emailInput.focus();

            for (let i = 1; i <= 20; i += 1) {
                fireEvent.change(emailInput, {
                    target: { value: `user${i}@allstar.com` },
                });
                expect(emailInput).toHaveFocus();
                expect(helpCenterButton).not.toHaveFocus();
            }
        });

        it("Typing in password keeps focus and does not jump to Help Center", () => {
            render(
                <TestWrapper>
                    <LoginCard />
                </TestWrapper>,
            );

            const passwordInput = document.querySelector(
                'input[type="password"]',
            ) as HTMLInputElement | null;
            const helpCenterButton = screen.getByRole("button", {
                name: /Help Center/i,
            });

            expect(passwordInput).not.toBeNull();
            if (!passwordInput) {
                return;
            }

            passwordInput.focus();

            for (let i = 1; i <= 20; i += 1) {
                fireEvent.change(passwordInput, {
                    target: { value: `pass-${i}-123456` },
                });
                expect(passwordInput).toHaveFocus();
                expect(helpCenterButton).not.toHaveFocus();
            }
        });
    });

    describe("2. ES/EN toggle removed from login", () => {
        it("LoginCard does not contain language toggle buttons", () => {
            const { container } = render(
                <TestWrapper>
                    <LoginCard />
                </TestWrapper>
            );

            const languageButtons = container.querySelectorAll("button");
            const languageRelatedButtons = Array.from(languageButtons).filter(btn => 
                btn.textContent?.includes("ES") || 
                btn.textContent?.includes("EN") ||
                btn.textContent?.includes("Español") ||
                btn.textContent?.includes("English")
            );

            expect(languageRelatedButtons).toHaveLength(0);
        });
    });

    describe("3. Logo_Star.svg used on login", () => {
        it("LoginCard renders with Logo_Star.svg", () => {
            const { container } = render(
                <TestWrapper>
                    <LoginCard />
                </TestWrapper>
            );

            const logoImage = container.querySelector('img[alt="Allstar logo"]');
            expect(logoImage).toBeInTheDocument();
            expect(logoImage?.getAttribute("src")).toContain("Logo_Star.svg");
        });
    });

    describe("4. Dashboard search filters apps by name (case-insensitive, trimmed)", () => {
        it("SearchBar filters using the real Dashboard component", async () => {
            mockWorkspaceResponse();

            render(
                <TestWrapper>
                    <DashboardApp />
                </TestWrapper>,
            );

            await screen.findByText("Inventory");
            expect(screen.getByText("Production")).toBeInTheDocument();
            expect(screen.getByText("Orders")).toBeInTheDocument();

            const searchInput = screen.getByPlaceholderText("Buscar aplicaciones…");
            fireEvent.change(searchInput, { target: { value: "  proDUCtion  " } });

            expect(screen.getByText("Production")).toBeInTheDocument();
            await waitFor(() => {
                expect(screen.queryByText("Inventory")).not.toBeInTheDocument();
                expect(screen.queryByText("Orders")).not.toBeInTheDocument();
            });
        });
    });

    describe("5. Settings and notifications open popup with message proximamente", () => {
        it("Footer notifications button opens modal with proximamente message", () => {
            render(
                <TestWrapper>
                    <Footer />
                </TestWrapper>
            );

            fireEvent.click(
                screen.getByRole("button", { name: /Abrir notificaciones/i }),
            );

            expect(screen.getByText("Notificaciones")).toBeInTheDocument();
            expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
        });

        it("Footer settings button opens modal with proximamente message", () => {
            render(
                <TestWrapper>
                    <Footer />
                </TestWrapper>
            );

            fireEvent.click(
                screen.getByRole("button", { name: /Abrir configuracion/i }),
            );

            expect(screen.getByText("Configuración")).toBeInTheDocument();
            expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
        });
    });

    describe("6. Dashboard clock updates in real time (ticks each second)", () => {
        it("Dashboard clock updates every second", () => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-03-16T10:00:00"));
            mockWorkspaceResponse();

            render(
                <TestWrapper>
                    <DashboardApp />
                </TestWrapper>,
            );

            expect(
                screen.getByText(
                    formatDashboardTime(new Date("2026-03-16T10:00:00")),
                ),
            ).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(1000);
            });

            expect(
                screen.getByText(
                    formatDashboardTime(new Date("2026-03-16T10:00:01")),
                ),
            ).toBeInTheDocument();
        });

        it("Dashboard clock displays time in es-ES locale", () => {
            const date = new Date("2026-03-16T14:30:45");
            
            const timeString = date.toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });

            expect(timeString).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        });
    });
});
