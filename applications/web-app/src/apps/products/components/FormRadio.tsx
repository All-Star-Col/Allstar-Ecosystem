import { motion } from "motion/react";

interface RadioOption {
    value: string;
    label: string;
}

interface FormRadioProps {
    label: string;
    options: RadioOption[];
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    error?: string;
}

export function FormRadio({
    label,
    options,
    value,
    onChange,
    required = false,
    error,
}: FormRadioProps) {
    return (
        <div className="space-y-3">
            <label className="block text-sm text-[#2F3339]">
                {label}
                {required && <span className="text-[#C7664C] ml-1">*</span>}
            </label>
            <div className="flex gap-4">
                {options.map((option) => {
                    const isSelected = value === option.value;
                    return (
                        <motion.label
                            key={option.value}
                            className={`
                flex items-center gap-3 px-5 py-3 rounded-lg border-2 cursor-pointer
                transition-all duration-200
                ${
                    isSelected
                        ? "border-[#122337] bg-[#122337]/5"
                        : "border-[rgba(47,51,57,0.15)] bg-white hover:border-[#B69559] hover:bg-[#B69559]/5"
                }
              `}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <input
                                type="radio"
                                value={option.value}
                                checked={isSelected}
                                onChange={(e) => onChange(e.target.value)}
                                className="sr-only"
                            />
                            <div
                                className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center
                transition-all duration-200
                ${
                    isSelected
                        ? "border-[#122337]"
                        : "border-[rgba(47,51,57,0.3)]"
                }
              `}
                            >
                                {isSelected && (
                                    <motion.div
                                        className="w-2.5 h-2.5 rounded-full bg-[#122337]"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 20,
                                        }}
                                    />
                                )}
                            </div>
                            <span
                                className={`text-sm ${isSelected ? "text-[#122337]" : "text-[#2F3339]"}`}
                            >
                                {option.label}
                            </span>
                        </motion.label>
                    );
                })}
            </div>
            {error && <p className="text-xs text-[#d4183d]">{error}</p>}
        </div>
    );
}
