import React, { useState, useRef } from "react";
import { Upload, X, File, AlertCircle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/shared/ui/button";

interface UploadedFile {
    id: string;
    file: File;
    preview?: string;
    status: "uploading" | "success" | "error";
    error?: string;
}

interface FileUploadProps {
    label: string;
    onChange: (files: File[]) => void;
    maxSize?: number; // in MB
    acceptedTypes?: string[];
}

export function FileUpload({
    label,
    onChange,
    maxSize = 10,
    acceptedTypes = ["image/jpeg", "image/png", "application/pdf"],
}: FileUploadProps) {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = (newFiles: FileList) => {
        setError("");
        const validFiles: UploadedFile[] = [];

        Array.from(newFiles).forEach((file) => {
            // Validate file type
            if (!acceptedTypes.includes(file.type)) {
                setError(`Tipo de archivo no permitido: ${file.name}`);
                return;
            }

            // Validate file size
            if (file.size > maxSize * 1024 * 1024) {
                setError(
                    `Archivo muy grande: ${file.name} (máx. ${maxSize}MB)`,
                );
                return;
            }

            const uploadedFile: UploadedFile = {
                id: Math.random().toString(36).substring(7),
                file,
                status: "uploading",
                preview: file.type.startsWith("image/")
                    ? URL.createObjectURL(file)
                    : undefined,
            };

            validFiles.push(uploadedFile);

            // Simulate upload
            setTimeout(() => {
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === uploadedFile.id
                            ? { ...f, status: "success" as const }
                            : f,
                    ),
                );
            }, 1000);
        });

        if (validFiles.length > 0) {
            const newFilesList = [...files, ...validFiles];
            setFiles(newFilesList);
            onChange(newFilesList.map((f) => f.file));
        }
    };

    const removeFile = (id: string) => {
        const newFiles = files.filter((f) => f.id !== id);
        setFiles(newFiles);
        onChange(newFiles.map((f) => f.file));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm text-secondary-foreground">{label}</label>

            {/* Drop Zone */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${
              isDragging
                  ? "border-foreground bg-primary/5"
                  : "border-input bg-white hover:border-accent hover:bg-accent/5"
          }
        `}
            >
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-secondary-foreground mb-1">
                    <span className="text-foreground">Haz clic para cargar</span>{" "}
                    o arrastra archivos aquí
                </p>
                <p className="text-xs text-muted-foreground">
                    PDF, JPG, PNG hasta {maxSize}MB
                </p>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptedTypes.join(",")}
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
                className="hidden"
            />

            {/* Error Message */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg"
                >
                    <AlertCircle className="w-4 h-4" />
                    {error}
                </motion.div>
            )}

            {/* File List */}
            <AnimatePresence>
                {files.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                    >
                        {files.map((uploadedFile) => (
                            <motion.div
                                key={uploadedFile.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="flex items-center gap-3 p-3 bg-white border border-border rounded-lg"
                            >
                                {uploadedFile.preview ? (
                                    <img
                                        src={uploadedFile.preview}
                                        alt={uploadedFile.file.name}
                                        className="w-12 h-12 object-cover rounded"
                                    />
                                ) : (
                                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                        <File className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-secondary-foreground truncate">
                                        {uploadedFile.file.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {(
                                            uploadedFile.file.size / 1024
                                        ).toFixed(1)}{" "}
                                        KB
                                    </p>
                                </div>

                                {uploadedFile.status === "uploading" && (
                                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                )}

                                {uploadedFile.status === "success" && (
                                    <CheckCircle2 className="w-5 h-5 text-success" />
                                )}

                                {uploadedFile.status === "error" && (
                                    <AlertCircle className="w-5 h-5 text-destructive" />
                                )}

                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeFile(uploadedFile.id);
                                    }}
                                >
                                    <X className="w-4 h-4 text-muted-foreground" />
                                </Button>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
