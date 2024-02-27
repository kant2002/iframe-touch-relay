interface AttachRelayOptions {
    debug: boolean;
    decodeCoordinates: (element: HTMLElement, x: number, y: number) => { clientX: number, clientY: number }
}

export function attachTouchRelay(): void;
export function detachTouchRelay(): void;
export function attachRelayToPage(my_zones: any, options?: Partial<AttachRelayOptions>): void;
export function detachRelayToPage(): void;
