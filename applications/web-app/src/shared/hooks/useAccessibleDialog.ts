import { useEffect, useRef, type RefObject } from "react";

interface UseAccessibleDialogOptions {
    isOpen: boolean;
    onClose: () => void;
    initialFocusRef?: RefObject<HTMLElement | null>;
    returnFocusRef?: RefObject<HTMLElement | null>;
}

export const useAccessibleDialog = ({
    isOpen,
    onClose,
    initialFocusRef,
    returnFocusRef,
}: UseAccessibleDialogOptions) => {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const previouslyFocusedRef = useRef<HTMLElement | null>(null);
    const wasOpenRef = useRef(false);

    useEffect(() => {
        if (!isOpen) {
            if (wasOpenRef.current) {
                const focusTarget =
                    returnFocusRef?.current ?? previouslyFocusedRef.current;
                focusTarget?.focus();
            }

            wasOpenRef.current = false;
            return;
        }

        wasOpenRef.current = true;

        previouslyFocusedRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;

        const frameId = window.requestAnimationFrame(() => {
            const focusTarget = initialFocusRef?.current ?? dialogRef.current;
            focusTarget?.focus();
        });

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") {
                return;
            }

            event.preventDefault();
            onClose();
        };

        window.addEventListener("keydown", onKeyDown);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [initialFocusRef, isOpen, onClose, returnFocusRef]);

    return { dialogRef };
};
