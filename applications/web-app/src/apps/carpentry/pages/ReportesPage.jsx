import React, { useMemo, useState } from 'react';
import { api, archivosApi } from '../api/client';
import { formatFecha } from '../utils/format';
import { dbLabel } from '../utils/labels';
import useToast from '../utils/useToast';
import CollapseToggle from '../components/CollapseToggle.jsx';

const reportesDisponibles = [
  { id: 'productividad', label: 'Productividad por proceso' },
  { id: 'cumplimiento', label: 'Cumplimiento de entregas' },
  { id: 'consumo', label: 'Consumo de materiales' },
  { id: 'bloqueos', label: 'Historial de bloqueos' },
  { id: 'avance', label: 'Avance de proyectos' },
];

function renderValue(key, value) {
  if (value === null || value === undefined || value === '') return '-';
  if (String(key).includes('fecha') || String(key).includes('semana')) return formatFecha(value);
  return String(value);
}

export default function ReportesPage() {
  const { showToast } = useToast();
  const [tipo, setTipo] = useState('productividad');
  const [filtros, setFiltros] = useState({ desde: '', hasta: '' });
  const [rows, setRows] = useState([]);
  const [resumenCumplimiento, setResumenCumplimiento] = useState([]);
  const [showReportPanel, setShowReportPanel] = useState(true);

  const headers = useMemo(() => (rows.length ? Object.keys(rows[0]) : []), [rows]);

  const cargarReporte = async () => {
    try {
      if (tipo === 'productividad') {
        const data = await api.reportes.productividad(filtros);
        setRows(data);
        setResumenCumplimiento([]);
      }

      if (tipo === 'cumplimiento') {
        const data = await api.reportes.cumplimiento(filtros);
        setRows(data.detalle || []);
        setResumenCumplimiento(data.resumen || []);
      }

      if (tipo === 'consumo') {
        const data = await api.reportes.consumo(filtros);
        setRows(data);
        setResumenCumplimiento([]);
      }

      if (tipo === 'bloqueos') {
        const data = await api.reportes.bloqueos(filtros);
        setRows(data);
        setResumenCumplimiento([]);
      }

      if (tipo === 'avance') {
        const data = await api.reportes.avance(filtros);
        setRows(data);
        setResumenCumplimiento([]);
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const exportarCsv = async () => {
    try {
      const data = await api.reportes.exportarCsv({ tipo, filtros });
      if (!data.csv) {
        showToast('No hay datos para exportar.', 'error');
        return;
      }
      await archivosApi.guardarCsv({
        filename: `reporte_${tipo}_${new Date().toISOString().slice(0, 10)}.csv`,
        csvContent: data.csv,
      });
      showToast('CSV exportado.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="stack">
      <section className={`panel${showReportPanel ? '' : ' panel-collapsed'}`}>
        <div className="panel-header">
          <h3>Reportes</h3>
          <CollapseToggle
            collapsed={!showReportPanel}
            onToggle={() => setShowReportPanel((v) => !v)}
            label="Reportes"
          />
        </div>

        {showReportPanel && (
        <div className="row" style={{ marginBottom: 12 }}>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {reportesDisponibles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <input
            title={dbLabel('desde')}
            type="date"
            value={filtros.desde}
            onChange={(e) => setFiltros((f) => ({ ...f, desde: e.target.value }))}
          />
          <input
            title={dbLabel('hasta')}
            type="date"
            value={filtros.hasta}
            onChange={(e) => setFiltros((f) => ({ ...f, hasta: e.target.value }))}
          />
          <button className="small" onClick={cargarReporte}>
            Cargar reporte
          </button>
          <button className="small ghost" onClick={exportarCsv}>
            Exportar CSV
          </button>
        </div>
        )}

        {showReportPanel && tipo === 'cumplimiento' && !!resumenCumplimiento.length && (
          <div className="row wrap">
            {resumenCumplimiento.map((r) => (
              <div key={r.alerta} className="kpi-card">
                <p>{r.alerta}</p>
                <strong>{r.total}</strong>
              </div>
            ))}
          </div>
        )}

        {showReportPanel && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${idx}-${Object.values(row)[0]}`}>
                  {headers.map((h) => (
                    <td key={`${idx}-${h}`}>{renderValue(h, row[h])}</td>
                  ))}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={headers.length || 1}>Carga un reporte para ver resultados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </section>
    </div>
  );
}
