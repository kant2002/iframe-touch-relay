interface AttachRelayOptions {
    debug: boolean;
    decodeCoordinates: (element: HTMLElement, x: number, y: number) => { clientX: number, clientY: number }
}

interface AttachTouchRelayOptions {
    debug: boolean;
}

export function attachTouchRelay(options?: Partial<AttachTouchRelayOptions>): void;
export function detachTouchRelay(): void;
export function attachRelayToPage(my_zones: any, options?: Partial<AttachRelayOptions>): void;
export function detachRelayToPage(): void;
