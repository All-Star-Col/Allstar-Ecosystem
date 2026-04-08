import React from 'react';

//_______________________________________
//  Componente | CollapseToggle
//_______________________________________

/**
    CollapseToggle:
    Botón reutilizable para colapsar o expandir secciones.
    - collapsed: boolean  | indica si la sección está colapsada
    - onToggle: function  | callback para alternar estado
    - label: string       | texto descriptivo de la sección
*/
export default function CollapseToggle({ collapsed, onToggle, label })
{
    return (
        <button
            type="button"
            onClick={onToggle}
            className="collapse-toggle-btn"
            data-collapsed={collapsed}
            title={collapsed ? `Mostrar ${label}` : `Ocultar ${label}`}
            aria-label={collapsed ? `Mostrar ${label}` : `Ocultar ${label}`}
            aria-expanded={!collapsed}
        >
            <span className="collapse-toggle-icon" aria-hidden="true">☰</span>
        </button>
    );
}
