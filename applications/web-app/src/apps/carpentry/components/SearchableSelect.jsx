//_______________________________________
//  Componente | SearchableSelect
//_______________________________________

/**
    SearchableSelect:
    Dropdown con búsqueda integrada y selección rápida.
    - options: array      | opciones [{value, label}]
    - value: string/num   | valor seleccionado
    - onChange: function  | callback al seleccionar
    - placeholder: string | texto de placeholder
    - disabled: boolean   | deshabilita input
    - className: string   | clases extra
*/
import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function SearchableSelect({
    options = [],
    value,
    onChange,
    placeholder = 'Buscar...',
    disabled,
    className = '',
})
{
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const ref = useRef(null);
    const optionRefs = useRef([]);

    const selected = useMemo(
        () => options.find((option) => String(option.value) === String(value)),
        [options, value]
    );

    const filtered = useMemo(() =>
    {
        const term = query.trim().toLowerCase();
        if (!term) return options;
        return options.filter((option) => String(option.label || '').toLowerCase().includes(term));
    }, [options, query]);

    useEffect(() =>
    {
        if (!open)
        {
            setQuery('');
            setHighlightedIndex(-1);
            return;
        }

        if (filtered.length === 0)
        {
            setHighlightedIndex(-1);
            return;
        }

        const selectedIdx = filtered.findIndex((option) => String(option.value) === String(value));
        setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    }, [open, filtered, value]);

    useEffect(() =>
    {
        if (!open || highlightedIndex < 0) return;
        const node = optionRefs.current[highlightedIndex];
        if (node) node.scrollIntoView({ block: 'nearest' });
    }, [open, highlightedIndex]);

    useEffect(() =>
    {
        const handler = (event) =>
        {
            if (ref.current && !ref.current.contains(event.target))
            {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectOption = (option) =>
    {
        onChange(option.value == null ? '' : String(option.value));
        setOpen(false);
        setQuery('');
        setHighlightedIndex(-1);
    };

    const highlightNext = (step) =>
    {
        if (!filtered.length) return;
        setHighlightedIndex((prev) =>
        {
            const base = prev < 0 ? (step > 0 ? -1 : 0) : prev;
            return (base + step + filtered.length) % filtered.length;
        });
    };

    return (
        <div ref={ref} className={`searchable-select ${className}`.trim()}>
            <input
                type="text"
                className="searchable-select-input"
                value={open ? query : (selected?.label || '')}
                onChange={(event) =>
                {
                    setQuery(event.target.value);
                    setOpen(true);
                    setHighlightedIndex(0);
                }}
                onFocus={() =>
                {
                    setOpen(true);
                    setQuery('');
                }}
                onKeyDown={(event) =>
                {
                    if (event.key === 'ArrowDown')
                    {
                        event.preventDefault();
                        if (!open) setOpen(true);
                        highlightNext(1);
                        return;
                    }

                    if (event.key === 'ArrowUp')
                    {
                        event.preventDefault();
                        if (!open) setOpen(true);
                        highlightNext(-1);
                        return;
                    }

                    if (event.key === 'Enter')
                    {
                        if (!open) return;
                        const option = filtered[highlightedIndex];
                        if (!option) return;
                        event.preventDefault();
                        selectOption(option);
                        return;
                    }

                    if (event.key === 'Tab')
                    {
                        if (!open) return;
                        const option = filtered[highlightedIndex];
                        if (option) selectOption(option);
                        else setOpen(false);
                        return;
                    }

                    if (event.key === 'Escape')
                    {
                        setOpen(false);
                    }
                }}
                placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-expanded={open}
        role="combobox"
        aria-autocomplete="list"
      />

      {open && filtered.length > 0 && (
        <ul className="searchable-select-menu" role="listbox">
          {filtered.map((option, index) => {
            const isSelected = String(option.value) === String(value);
            const isHighlighted = index === highlightedIndex;
            return (
              <li
                key={option.value}
                className={`searchable-select-option${isSelected ? ' is-selected' : ''}${isHighlighted ? ' is-highlighted' : ''}`}
                role="option"
                aria-selected={isSelected}
                ref={(node) => { optionRefs.current[index] = node; }}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </li>
            );
          })}
        </ul>
      )}

      {open && filtered.length === 0 && (
        <div className="searchable-select-empty">Sin resultados</div>
      )}
    </div>
  );
}
