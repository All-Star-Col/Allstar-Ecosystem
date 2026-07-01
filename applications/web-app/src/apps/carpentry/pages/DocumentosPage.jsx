import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import SearchableSelect from '../components/SearchableSelect.jsx';
import useToast from '../utils/useToast';
import { formatFecha, formatNumero } from '../utils/format';

function documentSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '-';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${formatNumero(value / 1024, 1)} KB`;
  return `${formatNumero(value / 1024 / 1024, 1)} MB`;
}

function primaryDate(row) {
  return row?.created_at || row?.fecha_firma || row?.updated_at || null;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isReceptionStage(value) {
  const normalized = normalizeText(value);
  return normalized.includes('acta') && normalized.includes('recepcion');
}

function isQuoteStage(value) {
  return normalizeText(value).includes('cotiz');
}

function DocumentActions({ item, onView, onDownload, onApprove, loadingId, canApprove = false }) {
  const busy = loadingId === item.id;
  return (
    <div className="documents-actions">
      {canApprove && (
        <button
          type="button"
          className={`small ${item.aprobado ? 'success' : 'ghost'}`}
          onClick={() => onApprove(item)}
          disabled={busy || item.aprobado}
        >
          {item.aprobado ? 'Aprobada' : 'Aprobar'}
        </button>
      )}
      <button type="button" className="small ghost" onClick={() => onView(item)} disabled={busy}>
        Visualizar
      </button>
      <button type="button" className="small" onClick={() => onDownload(item)} disabled={busy}>
        Descargar
      </button>
    </div>
  );
}

function DocumentsTable({ documentos, onView, onDownload, onApprove, loadingId, quoteStage = false }) {
  return (
    <div className="table-wrap">
      <table className="documents-data-table">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Archivo</th>
            <th>Subido por</th>
            <th>Fecha</th>
            <th>Tamano</th>
            <th className="documents-actions-column">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {documentos.map((documento) => (
            <tr key={documento.id}>
              <td>
                <strong>{documento.titulo || documento.nombre_archivo}</strong>
                {documento.aprobado && <div className="ok">Cotizacion aprobada</div>}
                {documento.descripcion && <div className="muted">{documento.descripcion}</div>}
              </td>
              <td>{documento.nombre_archivo || '-'}</td>
              <td>{documento.subido_por || '-'}</td>
              <td>{formatFecha(primaryDate(documento))}</td>
              <td>{documentSize(documento.tamano_bytes)}</td>
              <td className="documents-actions-column">
                <DocumentActions
                  item={documento}
                  onView={onView}
                  onDownload={onDownload}
                  onApprove={onApprove}
                  loadingId={loadingId}
                  canApprove={quoteStage}
                />
              </td>
            </tr>
          ))}
          {!documentos.length && (
            <tr>
              <td colSpan={6}>No hay documentos cargados en esta etapa.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReceptionActsTable({ actas, onView, onDownload, loadingId }) {
  return (
    <div className="table-wrap">
      <table className="documents-data-table documents-reception-table">
        <thead>
          <tr>
            <th>Acta</th>
            <th>Lote</th>
            <th>Apartamentos</th>
            <th>Cliente</th>
            <th>Fecha</th>
            <th className="documents-actions-column">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {actas.map((acta) => (
            <tr key={acta.id}>
              <td>{acta.nombre_archivo || `Acta ${acta.id}`}</td>
              <td>{acta.lote_nombre || '-'}</td>
              <td>{acta.apartamentos || '-'}</td>
              <td>{acta.cliente || '-'}</td>
              <td>{formatFecha(primaryDate(acta))}</td>
              <td className="documents-actions-column">
                <DocumentActions
                  item={acta}
                  onView={onView}
                  onDownload={onDownload}
                  loadingId={loadingId}
                />
              </td>
            </tr>
          ))}
          {!actas.length && (
            <tr>
              <td colSpan={6}>No hay actas de recepcion registradas para este proyecto.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function DocumentosPage() {
  const { showToast } = useToast();
  const [proyectos, setProyectos] = useState([]);
  const [proyectoId, setProyectoId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileLoadingId, setFileLoadingId] = useState(null);

  const proyectoOptions = useMemo(
    () => proyectos.map((p) => ({ value: String(p.id), label: `${p.nombre}${p.cliente ? ` - ${p.cliente}` : ''}` })),
    [proyectos],
  );

  const cargarProyectos = async () => {
    try {
      const rows = await api.proyectos.listar({});
      setProyectos(rows || []);
      if (!proyectoId && rows?.length) {
        setProyectoId(String(rows[0].id));
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const cargarDocumentos = async (id = proyectoId) => {
    if (!id) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const response = await api.documentos.listar({ proyecto_id: Number(id) });
      setData(response);
    } catch (error) {
      setData(null);
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProyectos();
  }, []);

  useEffect(() => {
    cargarDocumentos(proyectoId);
  }, [proyectoId]);

  const withFileLoading = async (item, callback) => {
    setFileLoadingId(item.id);
    try {
      await callback(item);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setFileLoadingId(null);
    }
  };

  const viewDocument = (documento) => withFileLoading(documento, api.documentos.visualizar);
  const downloadDocument = (documento) => withFileLoading(documento, api.documentos.descargar);
  const viewActa = (acta) => withFileLoading(acta, api.documentos.visualizarActaRecepcion);
  const downloadActa = (acta) => withFileLoading(acta, api.documentos.descargarActaRecepcion);
  const approveQuote = async (documento) => {
    setFileLoadingId(documento.id);
    try {
      await api.documentos.aprobarCotizacion({ id: documento.id });
      showToast('Cotizacion aprobada.');
      await cargarDocumentos(proyectoId);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setFileLoadingId(null);
    }
  };

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header">
          <h3>Documentos por proyecto</h3>
        </div>
        <div className="form-grid compact">
          <div className="field field-full">
            <label>Proyecto</label>
            <SearchableSelect
              options={proyectoOptions}
              value={proyectoId}
              onChange={(value) => setProyectoId(value)}
              placeholder="Selecciona un proyecto..."
            />
          </div>
        </div>
      </section>

      {data?.proyecto && (
        <section className="grid grid-3">
          <article className="panel">
            <h3>Proyecto</h3>
            <strong>{data.proyecto.nombre}</strong>
            <p className="muted">{data.proyecto.cliente || '-'}</p>
          </article>
          <article className="panel">
            <h3>Etapas</h3>
            <strong>{formatNumero(data.etapas?.length || 0, 0)}</strong>
            <p className="muted">Administrativas</p>
          </article>
          <article className="panel">
            <h3>Documentos</h3>
            <strong>{formatNumero((data.documentos?.length || 0) + (data.actas_recepcion?.length || 0), 0)}</strong>
            <p className="muted">Incluye actas de recepcion</p>
          </article>
        </section>
      )}

      {(data?.etapas || []).map((etapa) => {
        const receptionStage = isReceptionStage(etapa.etapa);
        const quoteStage = isQuoteStage(etapa.etapa);
        return (
          <section className="panel" key={etapa.proyecto_etapa_id}>
            <div className="panel-header">
              <h3>{etapa.etapa}</h3>
              {receptionStage && <span className="pill pill-gray">Solo tablet</span>}
            </div>
            {receptionStage ? (
              <ReceptionActsTable
                actas={data?.actas_recepcion || []}
                onView={viewActa}
                onDownload={downloadActa}
                loadingId={fileLoadingId}
              />
            ) : (
              <DocumentsTable
                documentos={etapa.documentos || []}
                onView={viewDocument}
                onDownload={downloadDocument}
                onApprove={approveQuote}
                loadingId={fileLoadingId}
                quoteStage={quoteStage}
              />
            )}
          </section>
        );
      })}

      {loading && <section className="panel">Cargando documentos...</section>}
    </div>
  );
}
