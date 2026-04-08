import React from 'react';

//_______________________________________
//  Componente | AppErrorBoundary
//_______________________________________

/**
    AppErrorBoundary:
    Componente de clase que actúa como boundary de errores para la UI de React.
    Si ocurre un error en el renderizado de cualquier hijo, muestra un mensaje de error y opción de recargar.
    - props: React.PropsWithChildren<any> | hijos a proteger
    - state: { hasError: boolean, message: string } | estado de error
*/
export default class AppErrorBoundary extends React.Component
{
    constructor(props)
    {
        super(props);
        this.state = { hasError: false, message: '' };
    }

    /*
        getDerivedStateFromError():
        Método estático de React para capturar errores en el árbol de componentes hijo.
        - error: Error | error capturado
        Retorna:
        - Object | nuevo estado con hasError y mensaje
    */
    static getDerivedStateFromError(error)
    {
        return {
            hasError: true,
            message: error?.message || 'Error inesperado en la interfaz.',
        };
    }

    /*
        componentDidCatch():
        Método de ciclo de vida para logging de errores en consola.
        - error: Error
        - info: info adicional
    */
    componentDidCatch(error, info)
    {
        // eslint-disable-next-line no-console
        console.error('Error de render en React:', error, info);
    }

    render()
    {
        if (this.state.hasError)
        {
            return (
                <div className="app-crash">
                    <h3>Ocurrió un error en la interfaz</h3>
                    <p>{this.state.message}</p>
                    <button type="button" onClick={() => window.location.reload()}>
                        Recargar aplicación
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}