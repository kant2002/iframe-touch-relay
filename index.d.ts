interface AttachRelayOptions {
    debug: boolean;
    decodeCoordinates: (element: HTMLElement, x: number, y: number) => {
        clientX: number;
        clientY: number;
    };
}
interface AttachTouchRelayOptions {
    debug: boolean;
}
export declare function attachTouchRelay(options?: Partial<AttachTouchRelayOptions>): void;
export declare function detachTouchRelay(): void;
export declare function attachRelayToPage(my_zones: HTMLIFrameElement[], options?: Partial<AttachRelayOptions>): void;
export declare function detachRelayToPage(): void;
export {};
