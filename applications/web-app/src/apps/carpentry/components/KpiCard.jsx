import React from 'react';

//_______________________________________
//  Componente | KpiCard
//_______________________________________

/**
    KpiCard:
    Tarjeta de métrica clave con ícono, valor y tendencia.
    - icon: ReactNode    | ícono a mostrar
    - title: string      | título de la métrica
    - value: string/num  | valor principal
    - subtitle: string   | texto secundario
    - trend: {direction, value} | tendencia (up/down)
    - accentColor: string| color de acento opcional
*/
export default function KpiCard({ icon, title, value, subtitle, trend, accentColor })
{
    const trendLabel = trend
        ? `${trend.direction === 'up' ? '+' : '−'}${Math.abs(Number(trend.value || 0))}`
        : null;

    return (
        <article
            className="kpi-card"
            style={accentColor ? { '--kpi-accent': accentColor } : undefined}
        >
            <div className="kpi-card-head">
                <span className="kpi-card-icon">{icon || '■'}</span>
                <p>{title}</p>
            </div>
            <strong className="kpi-card-value">{value ?? '—'}</strong>
            <div className="kpi-card-foot">
                <span>{subtitle}</span>
                {trendLabel && (
                    <span className={`kpi-trend ${trend.direction === 'up' ? 'up' : 'down'}`}>
                        {trendLabel}
                    </span>
                )}
            </div>
        </article>
    );
}
