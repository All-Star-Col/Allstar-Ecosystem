import { useState } from "react";
import { Button } from "@/shared/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/ui/card";
import { Textarea } from "@/shared/ui/textarea";
import { FileJson, Check } from "lucide-react";
import { toast } from "sonner";

interface SchemaPanelProps {
    onSchemaLoad?: (schema: any) => void;
}

const exampleSchema = {
    tables: [
        {
            id: "ejemplo_custom",
            name: "ejemplo_custom",
            displayName: "Tabla de Ejemplo",
            description: "Esta es una tabla de ejemplo creada desde JSON",
            category: "ventas",
            columns: [
                {
                    name: "campo_texto",
                    displayName: "Campo de Texto",
                    type: "varchar",
                    required: true,
                    maxLength: 100,
                },
                {
                    name: "campo_numero",
                    displayName: "Campo Numérico",
                    type: "integer",
                    required: false,
                },
            ],
        },
    ],
};

export function SchemaPanel({ onSchemaLoad }: SchemaPanelProps) {
    const [jsonInput, setJsonInput] = useState("");
    const [isExpanded, setIsExpanded] = useState(false);

    const handleLoadExample = () => {
        setJsonInput(JSON.stringify(exampleSchema, null, 2));
        toast.success("Esquema de ejemplo cargado");
    };

    const handleParseSchema = () => {
        try {
            const parsed = JSON.parse(jsonInput);
            if (onSchemaLoad) {
                onSchemaLoad(parsed);
            }
            toast.success("Esquema cargado correctamente", {
                description: "El esquema ha sido validado y cargado",
            });
        } catch (error) {
            toast.error("Error al parsear JSON", {
                description: "Verifica que el formato sea válido",
            });
        }
    };

    if (!isExpanded) {
        return (
            <div className="fixed bottom-6 right-6 z-50">
                <Button
                    onClick={() => setIsExpanded(true)}
                    className="bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-lg"
                >
                    <FileJson className="h-4 w-4 mr-2" />
                    Cargar esquema JSON
                </Button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 w-96">
            <Card className="shadow-2xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileJson className="h-5 w-5" />
                        Esquema personalizado
                    </CardTitle>
                    <CardDescription>
                        Pega un esquema JSON para cargar tablas personalizadas
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Textarea
                        value={jsonInput}
                        onChange={(e) => setJsonInput(e.target.value)}
                        placeholder='{ "tables": [...] }'
                        rows={8}
                        className="font-mono text-sm"
                    />
                    <div className="flex gap-2">
                        <Button
                            onClick={handleLoadExample}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                        >
                            Cargar ejemplo
                        </Button>
                        <Button
                            onClick={handleParseSchema}
                            disabled={!jsonInput}
                            size="sm"
                            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
                        >
                            <Check className="h-4 w-4 mr-1" />
                            Aplicar
                        </Button>
                    </div>
                    <Button
                        onClick={() => setIsExpanded(false)}
                        variant="ghost"
                        size="sm"
                        className="w-full"
                    >
                        Cerrar
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
