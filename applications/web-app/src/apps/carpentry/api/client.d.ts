export const api: {
    ping: () => Promise<unknown>;
};

export const archivosApi: {
    guardarCsv: (args: {
        filename?: string;
        csvContent?: string;
    }) => Promise<{ ok: boolean }>;
};
