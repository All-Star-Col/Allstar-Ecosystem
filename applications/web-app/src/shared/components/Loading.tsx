import { useEffect, useState } from "react";
import { motion } from "motion/react";
import starBlue from "@/assets/Logo_Star.svg";

export default function App() {
    const [currentStar, setCurrentStar] = useState(0);
    const stars = [starBlue];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentStar((prev) => (prev + 1) % stars.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div
            className="relative w-full h-screen overflow-hidden flex items-center justify-center"
            style={{ backgroundColor: "#F6F5F0" }}
        >
            {/* Texto Allstar gigante en el fondo con múltiples capas */}

            {/* Contenedor principal */}
            <div className="relative flex flex-col items-center justify-center z-10">
                {/* Estrella principal con animación de rotación y desaceleración */}
                <motion.div
                    key={currentStar}
                    className="relative"
                    initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
                    animate={{
                        opacity: 1,
                        scale: [1, 1.08, 1.08, 1],
                        rotate: [0, 180, 180, 360],
                    }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{
                        opacity: { duration: 0.5 },
                        scale: {
                            duration: 4,
                            ease: [0.4, 0, 0.2, 1],
                            times: [0, 0.4, 0.7, 1],
                            repeat: Infinity,
                        },
                        rotate: {
                            duration: 4,
                            ease: [0.4, 0, 0.2, 1],
                            times: [0, 0.4, 0.7, 1],
                            repeat: Infinity,
                        },
                    }}
                >
                    <motion.img
                        src={stars[currentStar]}
                        alt="Loading"
                        className="w-32 h-32 md:w-40 md:h-40 drop-shadow-2xl"
                    />

                    {/* Sombra dinámica */}
                    <motion.div
                        className="absolute inset-0 -z-10 blur-2xl"
                        style={{
                            backgroundColor: currentStar === 0 ? "#122337" : "#C7664C",
                            opacity: 0.3,
                        }}
                        animate={{
                            scale: [1, 1.5, 1],
                        }}
                        transition={{
                            duration: 2,
                            ease: "easeInOut",
                            repeat: Infinity,
                        }}
                    />
                </motion.div>

                {/* Loader de texto estilo css-loaders.com */}
                <motion.div
                    className="mt-20 text-center"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0, duration: 0.8 }}
                >
                    <div className="flex justify-center mt-4">
                        <div
                            className="
				relative
				w-fit
				font-mono
				font-bold
				text-[30px]
				text-transparent
				bg-[linear-gradient(90deg,#C7664C_calc(50%+0.5ch),#122337_0)]
				bg-[length:calc(200%+1ch)_100%]
				bg-right
				bg-clip-text
				before:content-['Loading...']
				animate-[l7_2s_infinite_steps(100)]
			"
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
