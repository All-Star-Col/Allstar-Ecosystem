// Dentro de QuickLoading.tsx
import { motion } from "framer-motion";

export default function QuickLoading() {
    return (
        <motion.div
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }} // CRUCIAL para AnimatePresence
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[url('@/assets/bg.jpg')] bg-cover bg-center bg-no-repeat"
        >
        {/* El backdrop-blur ahora entra suavemente */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

            <div className="relative w-[50px] aspect-square p-2 rounded-full bg-[#a7aba9] animate-spin
                    [mask-image:conic-gradient(#0000_10%,#000),linear-gradient(#000_0_0)]
                    [mask-clip:border-box,content-box]

                    [-webkit-mask-composite:source-out]
                    [mask-composite:subtract]">
            </div>
        </motion.div>
);
}