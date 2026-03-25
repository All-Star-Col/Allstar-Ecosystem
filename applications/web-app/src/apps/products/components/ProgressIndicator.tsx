import { Check } from "lucide-react";
import { motion } from "motion/react";

const PROGRESS_TRANSITION_DURATION = 0.3;

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
        <div className="bg-white rounded-lg p-4 shadow-sm border border-border mb-6">
            <div className="flex items-center justify-between relative">
                {/* Progress Line */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-border">
                    <motion.div
                        className="h-full bg-primary"
                        initial={{ width: "0%" }}
                        animate={{
                            width: `${(steps.filter((s) => s.completed).length / (steps.length - 1)) * 100}%`,
                        }}
                        transition={{ duration: PROGRESS_TRANSITION_DURATION, ease: "easeOut" }}
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
                        ? "bg-primary border-primary"
                        : step.active
                          ? "bg-white border-accent"
                          : "bg-white border-input"
                }
              `}
                        >
                            {step.completed ? (
                                <Check className="w-5 h-5 text-primary-foreground" />
                            ) : (
                                <span
                                    className={`text-sm ${step.active ? "text-accent" : "text-muted-foreground"}`}
                                >
                                    {index + 1}
                                </span>
                            )}
                        </motion.div>

                        {/* Label */}
                        <span
                            className={`
              mt-2 text-xs text-center
              ${step.active ? "text-foreground" : "text-muted-foreground"}
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
