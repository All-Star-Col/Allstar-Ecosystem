import React from 'react';
import { formatFecha } from '../utils/format';

//_______________________________________
//  Utils
//_______________________________________

/*
    processClass():
    Retorna la clase CSS según el nombre del proceso.
    - nombre: string | nombre del proceso
    Retorna:
    - string | clase CSS
*/
function processClass(nombre = '')
{
    const k = String(nombre).toLowerCase();
    if (k.includes('seccion'))   return 'proc-seccionado';
    if (k.includes('enchape'))   return 'proc-enchape';
    if (k.includes('mecan'))     return 'proc-mecanizado';
    if (k.includes('armado'))    return 'proc-armado';
    if (k.includes('transport')) return 'proc-transporte';
    if (k.includes('instal'))    return 'proc-instalacion';
    return 'proc-default';
}

const estadoLabel =
{
    pendiente:    'Pendiente',
    en_proceso:   'En proceso',
    completado:   'Completado',
    bloqueado:    'Bloqueado',
    omitido:      'Omitido',
};

//_______________________________________
//  Componente | PipelineBar
//_______________________________________

/**
    PipelineBar:
    Barra visual de procesos de lote/proyecto, muestra el pipeline y estado de cada nodo.
    - procesos: array      | lista de procesos
    - procesoActualId: id  | id del proceso activo
    - onSelectProceso: fn  | callback al seleccionar proceso
*/
export default function PipelineBar({ procesos, procesoActualId, onSelectProceso })
{
    return (
        <div className="pipeline-bar">
            {procesos.map((lp, idx) =>
            {
                const isActive  = String(lp.proceso_id) === String(procesoActualId) && lp.estado !== 'completado';
                const isDone    = lp.estado === 'completado';
                const isBlocked = lp.estado === 'bloqueado';

                return (
                    <button
                        key={lp.id}
                        type="button"
                        className={[
                            'pipeline-node',
                            processClass(lp.proceso),
                            isActive  ? 'active'  : '',
                            isDone    ? 'done'    : '',
                            isBlocked ? 'blocked' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={() => onSelectProceso && onSelectProceso(lp)}
                        title={lp.proceso}
                    >
                        <strong>{lp.proceso}</strong>
                        <span>{estadoLabel[lp.estado] || lp.estado}</span>
                        <small>
                            {formatFecha(lp.fecha_inicio_real) || '\u2014'}
                            {' \u2192 '}
                            {formatFecha(lp.fecha_fin_real) || '\u2014'}
                        </small>
                    </button>
                );
            })}
        </div>
    );
}
