import { motion, AnimatePresence } from "motion/react";
import { AlertCircle, X } from "lucide-react";

interface ErrorBannerProps {
    message: string;
    isVisible: boolean;
    onClose: () => void;
}

export function ErrorBanner({ message, isVisible, onClose }: ErrorBannerProps) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4"
                >
                    <div className="bg-[#C7664C] text-white rounded-lg shadow-xl p-4 flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 flex-shrink-0" />
                        <p className="flex-1 text-sm">{message}</p>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white transition-colors flex-shrink-0"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
