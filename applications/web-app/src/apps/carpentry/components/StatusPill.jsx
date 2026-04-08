import React from 'react';
import { semaforoClass } from '../utils/format';

//_______________________________________
//  Componente | StatusPill
//_______________________________________

/**
    StatusPill:
    Muestra un pill de estado con color semántico según valor.
    - value: string | valor del estado
*/
export default function StatusPill({ value })
{
    if (!value) return <span className="pill pill-gray">-</span>;
    const raw = String(value).replaceAll('_', ' ');
    const text = raw.charAt(0).toUpperCase() + raw.slice(1);
    return <span className={`pill ${semaforoClass(value)}`}>{text}</span>;
}
