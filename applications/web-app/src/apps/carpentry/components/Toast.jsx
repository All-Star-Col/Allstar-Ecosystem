import React from 'react';

//_______________________________________
//  Utils | Iconos Toast
//_______________________________________

const IconCheck = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const IconX = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

//_______________________________________
//  Componente | Toast
//_______________________________________

/**
    Toast:
    Notificación visual tipo toast (éxito o error).
    - toast: {type, message} | objeto de notificación
*/
export default function Toast({ toast })
{
    if (!toast) return null;
    const isError = toast.type === 'error';
    return (
        <div className={`toast ${toast.type || 'success'}`}>
            {isError ? <IconX /> : <IconCheck />}
            {toast.message}
        </div>
    );
}
