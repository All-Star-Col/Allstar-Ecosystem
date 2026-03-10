import { useEffect, useState } from "react";
import { EmailList } from "./EmailList";
import { ProductionFormWizard } from "./ProductionFormWizard";
import type { Email } from "../types";

interface EmailListApiItem {
    id: string;
    fromName?: string;
    fromEmail?: string;
    subject?: string;
    bodyPreview?: string;
    receivedDateTime?: string;
    hasAttachments?: boolean;
    isRead?: boolean;
    status?: Email["status"];
}

interface EmailDetailApiItem {
    id: string;
    fromName?: string;
    fromEmail?: string;
    subject?: string;
    receivedDateTime?: string;
    body?: string;
    bodyContentType?: "html" | "text";
    hasAttachments?: boolean;
    isRead?: boolean;
    bodyPreview?: string;
    status?: Email["status"];
}

interface ApiErrorPayload {
    message?: string;
    missing?: string[];
    hint?: string;
}

const EMAIL_FOLDER = "Formularios-Produccion";
const EMAIL_TOP = 50;

const toUiEmailFromList = (item: EmailListApiItem): Email => {
    const fromName = String(item.fromName ?? "").trim();
    const fromEmail = String(item.fromEmail ?? "").trim();
    const receivedDateTime = String(item.receivedDateTime ?? "").trim();
    const subject = String(item.subject ?? "").trim();
    const preview = String(item.bodyPreview ?? "").trim();

    return {
        id: String(item.id ?? ""),
        from: fromName || fromEmail || "Sin remitente",
        fromName,
        fromEmail,
        subject: subject || "(Sin asunto)",
        preview,
        receivedAt: receivedDateTime ? new Date(receivedDateTime) : new Date(),
        receivedDateTime,
        status: item.status || (item.isRead ? "listo_revisar" : "nuevo"),
        hasAttachments: Boolean(item.hasAttachments),
        isRead: Boolean(item.isRead),
    };
};

export function ProductionDashboard() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
    const [isLoadingEmails, setIsLoadingEmails] = useState(true);
    const [emailsError, setEmailsError] = useState("");
    const [reloadToken, setReloadToken] = useState(0);

    const selectedEmail = emails.find((e) => e.id === selectedEmailId);

    useEffect(() => {
        const controller = new AbortController();

        const loadEmails = async () => {
            setIsLoadingEmails(true);
            setEmailsError("");

            try {
                const query = new URLSearchParams({
                    folder: EMAIL_FOLDER,
                    top: String(EMAIL_TOP),
                    skip: "0",
                });

                const response = await fetch(
                    `http://localhost:3000/api/emails?${query.toString()}`,
                    {
                        method: "GET",
                        signal: controller.signal,
                    },
                );

                console.log(response)

                if (!response.ok) {
                    let payload: ApiErrorPayload | null = null;
                    let rawBody = "";
                    try {
                        // Lee el body una sola vez como texto
                        rawBody = await response.text();
                        // Intenta parsearlo como JSON
                        payload = JSON.parse(rawBody) as ApiErrorPayload;
                    } catch {
                        // Si no es JSON válido, usa el rawBody o un mensaje genérico
                    }

                    const missing = Array.isArray(payload?.missing)
                        ? payload.missing
                        : [];
                    const actionableMessage = missing.length
                        ? `Faltan variables de Microsoft Graph en el backend: ${missing.join(", ")}`
                        : payload?.message ||
                          `No se pudo cargar los correos (${response.status})`;

                    console.error("Error cargando lista de correos:", {
                        endpoint: `http://localhost:3000/api/emails?${query.toString()}`,
                        status: response.status,
                        body: payload ?? rawBody,
                    });

                    throw new Error(actionableMessage);
                }

                const data = (await response.json()) as EmailListApiItem[];
                const mapped = Array.isArray(data)
                    ? data.map(toUiEmailFromList).filter((e) => e.id)
                    : [];
                setEmails(mapped);
            } catch (error) {
                if ((error as DOMException).name === "AbortError") return;
                console.error("Excepcion cargando correos:", error);
                setEmails([]);
                setEmailsError(
                    error instanceof Error && error.message
                        ? error.message
                        : "No se pudo cargar los correos.",
                );
            } finally {
                setIsLoadingEmails(false);
            }
        };

        loadEmails();
        return () => controller.abort();
    }, [reloadToken]);

    const handleRefreshEmails = () => {
        setReloadToken((prev) => prev + 1);
    };

    const handleEmailSelect = (id: string) => {
        setSelectedEmailId(id);

        setEmails((prevEmails) =>
            prevEmails.map((email) =>
                email.id === id && email.status === "nuevo"
                    ? { ...email, status: "procesando_ia" }
                    : email,
            ),
        );

        const controller = new AbortController();
        const loadDetail = async () => {
            try {
                const response = await fetch(
                    `http://localhost:3000/api/emails/${encodeURIComponent(id)}`,
                    {
                        method: "GET",
                        signal: controller.signal,
                    },
                );

                if (!response.ok) {
                    const body = await response.text();
                    console.error("Error cargando detalle de correo:", {
                        endpoint: `http:/localhost:3000/api/emails/${id}`,
                        status: response.status,
                        body,
                    });
                    return;
                }

                const detail = (await response.json()) as EmailDetailApiItem;
                setEmails((prevEmails) =>
                    prevEmails.map((email) =>
                        email.id === id
                            ? {
                                  ...email,
                                  fromName: String(
                                      detail.fromName ?? email.fromName ?? "",
                                  ),
                                  fromEmail: String(
                                      detail.fromEmail ?? email.fromEmail ?? "",
                                  ),
                                  from:
                                      String(detail.fromName ?? "").trim() ||
                                      String(detail.fromEmail ?? "").trim() ||
                                      email.from,
                                  subject: String(
                                      detail.subject ?? email.subject ?? "",
                                  ),
                                  body: String(detail.body ?? email.body ?? ""),
                                  bodyContentType:
                                      detail.bodyContentType === "text"
                                          ? "text"
                                          : "html",
                                  hasAttachments: Boolean(
                                      detail.hasAttachments,
                                  ),
                                  isRead: Boolean(detail.isRead),
                                  status: detail.status || email.status,
                                  preview: String(
                                      detail.bodyPreview ?? email.preview ?? "",
                                  ),
                                  receivedAt: detail.receivedDateTime
                                      ? new Date(detail.receivedDateTime)
                                      : email.receivedAt,
                                  receivedDateTime: String(
                                      detail.receivedDateTime ??
                                          email.receivedDateTime ??
                                          "",
                                  ),
                              }
                            : email,
                    ),
                );
            } catch (error) {
                if ((error as DOMException).name === "AbortError") return;
                console.error("Excepcion cargando detalle de correo:", error);
            }
        };

        loadDetail();
    };

    const handleFormSuccess = (_opNumber: string) => {
        if (selectedEmailId) {
            setEmails((prevEmails) =>
                prevEmails.map((email) =>
                    email.id === selectedEmailId
                        ? { ...email, status: "enviado" }
                        : email,
                ),
            );
        }
        setReloadToken((prev) => prev + 1);
    };

    const handleFormCancel = () => {
        setSelectedEmailId(null);
    };

    return (
        <div className="h-screen flex bg-[#F6F5F0]">
            <div className="w-96 flex-shrink-0">
                <EmailList
                    emails={emails}
                    selectedEmailId={selectedEmailId}
                    onSelectEmail={handleEmailSelect}
                    onRefresh={handleRefreshEmails}
                    isLoading={isLoadingEmails}
                    error={emailsError}
                />
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {selectedEmail ? (
                    <ProductionFormWizard
                        email={selectedEmail}
                        onSuccess={handleFormSuccess}
                        onCancel={handleFormCancel}
                    />
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-32 h-32 mx-auto mb-6 bg-[#122337]/5 rounded-full flex items-center justify-center">
                                <svg
                                    className="w-16 h-16 text-[#5a5c61]"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-xl text-[#122337] mb-2">
                                Selecciona un correo
                            </h3>
                            <p className="text-sm text-[#5a5c61] max-w-sm mx-auto">
                                Selecciona un correo de la lista para procesar
                                el pedido con IA y crear una orden de
                                produccion.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
