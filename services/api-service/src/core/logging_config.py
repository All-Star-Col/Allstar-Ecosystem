import logging
import os
import sys
from typing import Iterable, Tuple

_LOGGING_CONFIGURED = False
_HANDLER_FLAG = "_allstar_logging_handler"
_DEFAULT_APP_NAMESPACES: Tuple[str, ...] = ("src", "app")
_NOISY_EXTERNAL_LOGGERS: Tuple[str, ...] = (
    "apscheduler",
    "urllib3",
    "httpx",
    "passlib",
    "tzlocal",
    "bitwarden_sdk",
)


def _parse_level(value: str, default: int) -> int:
    level = logging.getLevelName(value.upper())
    return level if isinstance(level, int) else default


def _normalize_namespaces(namespaces: Iterable[str]) -> Tuple[str, ...]:
    normalized = tuple(dict.fromkeys(ns.strip(" .") for ns in namespaces if ns))
    return normalized or _DEFAULT_APP_NAMESPACES


def _is_app_logger(logger_name: str, app_namespaces: Tuple[str, ...]) -> bool:
    return any(
        logger_name == namespace or logger_name.startswith(f"{namespace}.")
        for namespace in app_namespaces
    )


class AppLogsFilter(logging.Filter):
    def __init__(
        self,
        app_namespaces: Tuple[str, ...],
        external_min_level: int,
    ) -> None:
        super().__init__()
        self.app_namespaces = app_namespaces
        self.external_min_level = external_min_level

    def filter(self, record: logging.LogRecord) -> bool:
        if record.name.startswith("uvicorn.access"):
            return record.levelno >= logging.INFO
        if record.name.startswith("uvicorn.error"):
            return record.levelno >= logging.INFO
        if _is_app_logger(record.name, self.app_namespaces):
            return True
        return record.levelno >= self.external_min_level


class CustomFormatter(logging.Formatter):
    grey = "\x1b[38;20m"
    blue = "\x1b[38;5;39m"
    green_matrix = "\x1b[38;5;40m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"

    def __init__(self, use_colors: bool, app_namespaces: Tuple[str, ...]) -> None:
        self.use_colors = use_colors
        self.app_namespaces = app_namespaces
        base_format = (
            "%(asctime)s | %(levelname_colored)s | %(name)s | %(message)s | "
            "File:(%(filename)s:%(lineno)d)"
        )
        super().__init__(fmt=base_format, datefmt="%Y-%m-%d %H:%M:%S")

    def _pick_color(self, record: logging.LogRecord) -> str:
        if record.levelno == logging.INFO and _is_app_logger(
            record.name, self.app_namespaces
        ):
            return self.blue
        if record.levelno == logging.DEBUG and _is_app_logger(
            record.name, self.app_namespaces
        ):
            return self.green_matrix
        if record.levelno == logging.WARNING:
            return self.yellow
        if record.levelno == logging.ERROR:
            return self.bold_red
        if record.levelno == logging.CRITICAL:
            return self.red
        return self.grey

    def format(self, record: logging.LogRecord) -> str:
        if self.use_colors:
            color = self._pick_color(record)
            record.levelname_colored = f"{color}{record.levelname}{self.reset}"
        else:
            record.levelname_colored = record.levelname
        return super().format(record)


def setup_logging(
    app_namespaces: Iterable[str] = _DEFAULT_APP_NAMESPACES,
    app_level: int | None = None,
    external_min_level: int | None = None,
) -> None:
    global _LOGGING_CONFIGURED
    if _LOGGING_CONFIGURED:
        return

    app_namespaces_resolved = _normalize_namespaces(app_namespaces)
    resolved_app_level = (
        app_level
        if app_level is not None
        else _parse_level(os.getenv("APP_LOG_LEVEL", "DEBUG"), logging.DEBUG)
    )
    resolved_external_level = (
        external_min_level
        if external_min_level is not None
        else _parse_level(os.getenv("APP_EXTERNAL_LOG_LEVEL", "ERROR"), logging.ERROR)
    )

    root_logger = logging.getLogger()
    root_logger.setLevel(min(resolved_app_level, resolved_external_level))

    # Evita handlers duplicados sin borrar handlers de otras integraciones.
    has_our_handler = any(
        getattr(handler, _HANDLER_FLAG, False) for handler in root_logger.handlers
    )
    if not has_our_handler:
        stream_handler = logging.StreamHandler()
        stream_handler.setLevel(min(resolved_app_level, resolved_external_level))
        stream_handler.setFormatter(
            CustomFormatter(
                use_colors=sys.stderr.isatty() and not os.getenv("NO_COLOR"),
                app_namespaces=app_namespaces_resolved,
            )
        )
        stream_handler.addFilter(
            AppLogsFilter(
                app_namespaces=app_namespaces_resolved,
                external_min_level=resolved_external_level,
            )
        )
        setattr(stream_handler, _HANDLER_FLAG, True)
        root_logger.addHandler(stream_handler)

    # Permitir logs utiles de FastAPI/Uvicorn (incluye codigos HTTP en access).
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)

    # Reducir ruido de librerias externas frecuentes.
    for logger_name in _NOISY_EXTERNAL_LOGGERS:
        logging.getLogger(logger_name).setLevel(
            max(logging.getLogger(logger_name).level, resolved_external_level)
        )

    _LOGGING_CONFIGURED = True


def get_logger(name: str = "src.app") -> logging.Logger:
    setup_logging()
    return logging.getLogger(name)
