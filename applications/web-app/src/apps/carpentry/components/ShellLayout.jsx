
//_______________________________________
//  Utils | Iconos y helpers ShellLayout
//_______________________________________

import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { carpentryPath } from '../routes';

const CARPENTRY_THEME_STORAGE_KEY = 'carpentry-theme';

function resolveInitialTheme()
{
    if (typeof window === 'undefined') return 'light';

    const savedTheme = window.localStorage.getItem(CARPENTRY_THEME_STORAGE_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light')
    {
        return savedTheme;
    }

    return 'light';
}

const IconDashboard = () => (
    <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
);
const IconProyectos = () => (
    <svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h3l2 3h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>
);
const IconLotes = () => (
    <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
);
const IconBom = () => (
    <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10"/><path d="M7 12h10"/><path d="M7 16h6"/></svg>
);
const IconInventario = () => (
    <svg viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>
);
const IconProduccion = () => (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>
);
const IconRecursos = () => (
    <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const IconCatalogo = () => (
    <svg viewBox="0 0 24 24"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><path d="M16 3H8a2 2 0 0 0-2 2v2h12V5a2 2 0 0 0-2-2z"/><path d="M12 12v4"/><path d="M10 14h4"/></svg>
);
const IconReportes = () => (
    <svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6"  y1="20" x2="6"  y2="14"/></svg>
);

const IconSun = () => (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M19.07 4.93l-1.41 1.41M6.34 17.66l-1.41 1.41"/></svg>
);
const IconMoon = () => (
    <svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8z"/></svg>
);
const IconChevronLeft = () => (
    <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
);
const IconChevronRight = () => (
    <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
);
const IconBack = () => (
    <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/><path d="M9 12h11"/></svg>
);

const items = [
    { to: carpentryPath(),             label: 'Dashboard',     Icon: IconDashboard  },
    { to: carpentryPath('proyectos'),  label: 'Proyectos',     Icon: IconProyectos  },
    { to: carpentryPath('lotes'),      label: 'Lotes',         Icon: IconLotes      },
    { to: carpentryPath('bom'),        label: 'BOM / Diseño',  Icon: IconBom        },
    { to: carpentryPath('catalogo'),   label: 'Catálogo Mat.', Icon: IconCatalogo   },
    { to: carpentryPath('inventario'), label: 'Inventario',    Icon: IconInventario },
    { to: carpentryPath('produccion'), label: 'Producción',    Icon: IconProduccion, disabled: true },
    { to: carpentryPath('recursos'),   label: 'Recursos',      Icon: IconRecursos   },
    { to: carpentryPath('reportes'),   label: 'Reportes',      Icon: IconReportes, disabled: true },
];

//_______________________________________
//  Componente | ShellLayout
//_______________________________________

/**
    ShellLayout:
    Layout principal de la app: sidebar, topbar, navegación y children.
    - children: ReactNode | contenido de la página
*/
export default function ShellLayout({ children })
{
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [theme, setTheme] = useState(resolveInitialTheme);

    const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

    useEffect(() =>
    {
        window.localStorage.setItem(CARPENTRY_THEME_STORAGE_KEY, theme);
    }, [theme]);

    return (
        <div className={`app-shell ${collapsed ? 'collapsed' : ''}`} data-theme={theme}>
            <aside className="sidebar">
                {/* Brand */}
                <div className="brand">
                    <h1>ALL STAR</h1>
                    {!collapsed && (
                        <p className="brand-tag">
                            <span className="brand-dot" />
                            Control de Producción
                        </p>
                    )}
                </div>

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {items.map(({ to, label, Icon, disabled }) => {
                        if (disabled) {
                            return (
                                <span
                                    key={to}
                                    className="nav-item is-disabled"
                                    aria-disabled="true"
                                    title={collapsed ? `${label} (deshabilitado)` : undefined}
                                >
                                    <span className="nav-icon">
                                        <Icon />
                                    </span>
                                    {!collapsed && <span className="nav-label">{label}</span>}
                                </span>
                            );
                        }

                        return (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === carpentryPath()}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                title={collapsed ? label : undefined}
                            >
                                <span className="nav-icon">
                                    <Icon />
                                </span>
                                {!collapsed && <span className="nav-label">{label}</span>}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="sidebar-footer">
                    <div className="sidebar-footer-controls">
                        <button
                            type="button"
                            className="ghost icon-toggle"
                            onClick={toggleTheme}
                            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                            aria-pressed={theme === 'dark'}
                        >
                            {theme === 'dark' ? <IconSun /> : <IconMoon />}
                            <span className="sidebar-btn-label">
                                {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
                            </span>
                        </button>
                        <button
                            type="button"
                            className="ghost icon-toggle"
                            onClick={() => navigate('/dashboard')}
                            title="Regresar"
                        >
                            <IconBack />
                            <span className="sidebar-btn-label">Regresar</span>
                        </button>
                        <button
                            type="button"
                            className="ghost icon-toggle"
                            onClick={() => setCollapsed((v) => !v)}
                            title={collapsed ? 'Expandir' : 'Comprimir'}
                        >
                            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
                            <span className="sidebar-btn-label">
                                {collapsed ? 'Expandir' : 'Comprimir'}
                            </span>
                        </button>
                    </div>
                    {!collapsed && <span className="sidebar-version">v1.1.0</span>}
                </div>
            </aside>

            <main className="main-content">
                <section className="content-area">{children}</section>
            </main>
        </div>
    );
}
