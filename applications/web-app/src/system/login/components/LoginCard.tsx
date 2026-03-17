import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InputField } from "./InputField";
import { HelpCenterModal } from "./HelpCenterModal";
import { motion } from "motion/react";
import { API_SERVER } from "../../../config/api";
import LogoStar from "../../../assets/Logo_Star.svg";

export const LoginCard: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isHelpCenterOpen, setIsHelpCenterOpen] = useState(false);
    const helpCenterButtonRef = useRef<HTMLButtonElement | null>(null);

    type LoginSuccessResponse = {
        access_token: string;
        token_type: string;
    };

    type LoginErrorResponse = {
        detail?: string;
    };

    const isObject = (value: unknown): value is Record<string, unknown> => {
        return typeof value === "object" && value !== null;
    };

    const isLoginSuccessResponse = (
        value: unknown,
    ): value is LoginSuccessResponse => {
        if (!isObject(value)) {
            return false;
        }

        return (
            typeof value.access_token === "string" &&
            typeof value.token_type === "string"
        );
    };

    const getBackendMessage = (value: unknown): string | null => {
        if (!isObject(value)) {
            return null;
        }

        const errorPayload = value as LoginErrorResponse;
        return typeof errorPayload.detail === "string"
            ? errorPayload.detail
            : null;
    };

    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email || !password) {
            setError("Por favor, ingresa tu correo y contraseña.");
            return;
        }

        try {
            setIsLoading(true);

            const body = new URLSearchParams();
            body.set("username", email.trim());
            body.set("password", password);

            const response = await fetch(`${API_SERVER}/login`, {
                method: "POST",
                headers: {
                    "Content-type": "application/x-www-form-urlencoded",
                },
                body,
            });

            let payload: unknown = null;
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
                payload = await response.json();
            } else {
                payload = await response.text();
            }

            if (!response.ok) {
                const backendMsg = getBackendMessage(payload);

                if (response.status === 401 || response.status === 403) {
                    setError(
                        backendMsg ||
                            "Credenciales inválidas. Verifica tu correo y contraseña.",
                    );
                    return;
                }

                if (response.status === 422) {
                    setError(
                        backendMsg ||
                            "Datos inválidos. Revisa el correo/contraseña e intenta de nuevo.",
                    );
                    return;
                }

                setError(
                    backendMsg ||
                        `Error al iniciar sesión (HTTP ${response.status}).`,
                );
                return;
            }

            if (!isLoginSuccessResponse(payload)) {
                setError(
                    "Respuesta inesperada del servidor. No se recibió el token de acceso.",
                );
                return;
            }

            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem("access_token", payload.access_token);

            navigate("/dashboard", { replace: true });
        } catch (e) {
            setError("Error al iniciar sesión. Por favor, intenta nuevamente.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0.95, scale: 0.25 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                duration: 0.25,
            }}
            className="w-full"
        >
            <div className="w-full bg-card-light backdrop-blur-sm rounded-md shadow-premiun p-10 pb-4 border-0 animate-fade-in-up">
                <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-full flex justify-between items-center text-[10px] font-bold tracking-tight text-slate-400 uppercase">
                        <div className=" flex items-center gap-1.5 text-emerald-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            Sistemas operativos
                        </div>
                    </div>

                    <div className="text-white rounded-xl flex items-center justify-center shadow-lag mt-5 transform transition-transform hover:scale-105 duration-300">
                        <img
                            src={LogoStar}
                            alt="Allstar logo"
                            className="h-10 w-10"
                        />
                    </div>

                    <h1 className="text-2xl font-bold text-text-main">
                        {" "}
                        All star
                    </h1>
                    <p className="text-xs bold-text text-slate-500 font-medium leading-relaxed">
                        {" "}
                        Diseñamos con propósito. Fabricamos con excelencia{" "}
                    </p>
                </div>

                <form
                    className="space-y-4 pt-10"
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <InputField
                        label="Correo Corporativo"
                        iconName="mail_outline"
                        placeholder="username@allstar.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <InputField
                        label="Contraseña"
                        iconName="lock_outline"
                        placeholder="••••••••••••"
                        isPassword
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <div className="flex items-center justify-between text-xs pt-1">
                        <label className="flex items-center space-x-2 cursor-pointer group select-none">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) =>
                                    setRememberMe(e.target.checked)
                                }
                                className="h-4 w-4 text-primery bg-slate-100 border-slate-300 focus:ring-primary focus:ring-2 transition-all cursor-pointer"
                            />
                            <span className="text-slate-500 group-hover:text-slate-800 transtion-colors select-none cursor-pointer">
                                Recordar sesión
                            </span>
                        </label>

                        <a
                            href="/404"
                            className="text-primary hover:text-primary-hover font-semibold transition-colors focus:outline-none focus:underline cursor-pointer"
                        >
                            ¿Olvidaste tu contraseña?
                        </a>
                    </div>

                    {error && (
                        <div className="text-sm text-bold-text text-red-600 bg-red-50 border border-red-200 rounded rounded-md px-4 py-2">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 group mt-2 ${isLoading ? "opacity-80 cursor-wait " : ""}`}
                    >
                        {isLoading ? (
                            <span className="inline-block w-5 h-5 border-2 border-white-30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <span>Ingresar al sistema</span>
                                <span className="material-icons-round text lg group-hover:translate-x-1 transition-transform">
                                    arrow_forward
                                </span>
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-5 pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span> v1.0.0</span>
                    <button
                        ref={helpCenterButtonRef}
                        type="button"
                        onClick={() => setIsHelpCenterOpen(true)}
                        className="flex items-center gap-1 hover:text-slate-600 transition-colors text-xs"
                    >
                        Help Center
                        <span className="material-icons-round text-xs">
                            {" "}
                            help_outline
                        </span>
                    </button>
                </div>
            </div>

            <HelpCenterModal
                isOpen={isHelpCenterOpen}
                onClose={() => setIsHelpCenterOpen(false)}
                returnFocusRef={helpCenterButtonRef}
            />
        </motion.div>
    );
};
