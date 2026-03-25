import { motion } from "motion/react";
// import { duration, stagger } from "../../../shared/animations";

interface HeaderProps {
    timeString: string;
    dateString: string;
    name?: string;
}

export function Header({ timeString, dateString, name }: HeaderProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex justify-between items-start mb-8"
        >
            {/* Left side */}
            <div>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="text-xs text-muted-foreground tracking-wide mb-2"
                >
                    CENTRO DE TRABAJO
                </motion.div>
                <motion.h1
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="text-3xl font-semibold text-foreground m-0"
                >
                    Buenos días {name?.split(" ")[0]}
                </motion.h1>
            </div>

            {/* Right side */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center gap-3"
            >
                <div className="text-right mr-2">
                    <div className="text-[13px] font-medium text-secondary-foreground">
                        {timeString}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {dateString?.toUpperCase()}
                    </div>
                </div>

                <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-9 h-9 rounded-full flex items-center justify-center bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
                >
                    {name ? name.charAt(0).toUpperCase() : "U"}
                </motion.div>
            </motion.div>
        </motion.div>
    );
}
