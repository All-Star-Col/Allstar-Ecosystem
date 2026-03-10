import { Check } from "lucide-react";
import { motion } from "motion/react";

interface Step {
    label: string;
    completed: boolean;
    active: boolean;
}

interface ProgressIndicatorProps {
    steps: Step[];
}

export function ProgressIndicator({ steps }: ProgressIndicatorProps) {
    return (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-[rgba(47,51,57,0.08)] mb-6">
            <div className="flex items-center justify-between relative">
                {/* Progress Line */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-[rgba(47,51,57,0.1)]">
                    <motion.div
                        className="h-full bg-[#122337]"
                        initial={{ width: "0%" }}
                        animate={{
                            width: `${(steps.filter((s) => s.completed).length / (steps.length - 1)) * 100}%`,
                        }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>

                {steps.map((step, index) => (
                    <div
                        key={index}
                        className="flex flex-col items-center relative z-10"
                    >
                        {/* Circle */}
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                ${
                    step.completed
                        ? "bg-[#122337] border-[#122337]"
                        : step.active
                          ? "bg-white border-[#B69559]"
                          : "bg-white border-[rgba(47,51,57,0.2)]"
                }
              `}
                        >
                            {step.completed ? (
                                <Check className="w-5 h-5 text-[#F6F5F0]" />
                            ) : (
                                <span
                                    className={`text-sm ${step.active ? "text-[#B69559]" : "text-[#5a5c61]"}`}
                                >
                                    {index + 1}
                                </span>
                            )}
                        </motion.div>

                        {/* Label */}
                        <span
                            className={`
              mt-2 text-xs text-center
              ${step.active ? "text-[#122337]" : "text-[#5a5c61]"}
            `}
                        >
                            {step.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
