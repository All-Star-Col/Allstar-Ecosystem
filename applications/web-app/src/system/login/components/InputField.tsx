import React, { useState } from "react";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    iconName: string;
    isPassword?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
    label,
    iconName,
    isPassword = false,
    className,
    ...props
}) => {
    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const inputType = isPassword
        ? showPassword
            ? "text"
            : "password"
        : props.type || "text";

    return (
        <div className={`space-y-1.5 ${className || ""}`}>
            <label className="block text-xs font-bold text-slate-600 ml-1 uppercase tracking-wide">
                {label}
            </label>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                    <span className="material-icons-round text-lg">
                        {iconName}
                    </span>
                </div>

                <input
                    {...props}
                    type={inputType}
                    className="block w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 focus:border-[1.5px] focus:border-[var(--gold-border)] transition-all shadow-sm hover:border-slate-300"
                />

                {isPassword && (
                    <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors focus:outline-none"
                    >
                        <span className="material-icons-round text-lg">
                            {showPassword ? "visibility" : "visibility_off"}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
};
