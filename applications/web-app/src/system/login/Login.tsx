import { LoginCard } from "./components/LoginCard";

export default function Login() {
    return (
        <div className="min-h-screen relative w-full overflow-hidden bg-[url('@/assets/bg.jpg')] bg-cover bg-center bg-no-repeat">
            {/* BACKGROUND GLOBAL (cubre TODA la pantalla) */}
            {/* Gradiente global */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <div className="relative min-h-screen w-full flex">
                <div className="flex-1" />
                <div className="relative w-[520px] flex items-center justify-center px-6 py-0 overflow-hidden rounded-none">
                    <LoginCard />
                </div>
                <div className="flex-1" />
            </div>
        </div>
    );
}
