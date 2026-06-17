export default function NotFound() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur">
                <div className="p-6 sm:p-8">
                    <div className="flex items-start gap-4">
                        <div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
                            <span className="text-lg font-semibold">404</span>
                        </div>

                        <div className="flex-1">
                            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
                                New page to {location.pathname}
                            </h2>

                            <p className="mt-2 text-sm sm:text-base text-slate-600">
                                We couldn’t find anything at{" "}
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-slate-800">
                                    {location.pathname}
                                </span>
                                . Try checking the URL or head back to a safe
                                place.
                            </p>

                            <div className="mt-5 flex flex-wrap gap-3">
                                <a
                                    href="/dashboard"
                                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
                                >
                                    Go to Dashboard
                                </a>

                                <button
                                    type="button"
                                    onClick={() => window.history.back()}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                                >
                                    Go back
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navigator.clipboard?.writeText(
                                            window.location.href,
                                        )
                                    }
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
                                >
                                    Copy link
                                </button>
                            </div>

                            <div className="mt-6 rounded-xl bg-slate-50 p-4">
                                <p className="text-xs font-medium text-slate-500">
                                    Quick hints
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                                    <li>
                                        • Path segments:{" "}
                                        <span className="font-mono">
                                            {location.pathname
                                                .split("/")
                                                .filter(Boolean)
                                                .join(" / ") || "—"}
                                        </span>
                                    </li>
                                    <li>
                                        • Looks like:{" "}
                                        <span className="font-mono">
                                            {location.pathname === "/"
                                                ? "Home"
                                                : "Unknown route"}
                                        </span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
