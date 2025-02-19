interface AttachRelayOptions {
    debug: boolean;
    decodeCoordinates: (element: HTMLElement, x: number, y: number) => { clientX: number, clientY: number }
}

interface AttachTouchRelayOptions {
    debug: boolean;
}

interface FakeTouch {
    clientX: number; 
    clientY: number;
    identifier: number;
}

interface FakeTouchEvent {
    eventName: "touchstart" | "touchend" | "touchmove" | "touchcancel";
    touches: FakeTouch[];
}

interface FakeClickEvent {
    eventName: "click";
    clientX: number; 
    clientY: number;
}

let zones: HTMLIFrameElement[];

/**
 * Gets map of split touches.
 * @param {TouchList} touches List of touches to split by zones
 * @returns Map of split touches by zone keys. -1 for regular document.
 */
function splitTouches(touches: TouchList) {
    const result : Record<number, Touch[]> = {}
    result[-1] = [];
    for (const zoneNdx in zones) {
        result[zoneNdx] = [];
    }
    for (const touch of touches) {
        let processed = false;
        for (let zoneNdx = 0; zoneNdx < zones.length; zoneNdx++) {
            const zone = zones[zoneNdx];
            const boundary = zone.getBoundingClientRect();
            if (touch.clientX > boundary.left && touch.clientX < boundary.right
                && touch.clientY > boundary.top && touch.clientY < boundary.bottom) {
                processed = true;
                result[zoneNdx] = result[zoneNdx].concat([touch]);
            }
        }
        if (!processed) {
            result[-1] = result[-1].concat([touch]);
        }
    }

    return result;
}

/**
 * Gets map of split touches.
 * @param {MouseEvent} touches List of touches to split by zones
 * @returns Map of split touches by zone keys. -1 for regular document.
 */
function splitClick(click: MouseEvent) {
    const result : Record<number, MouseEvent[]> = {}
    result[-1] = [];
    for (const zoneNdx in zones) {
        result[zoneNdx] = [];
    }
    let processed = false;
    for (let zoneNdx = 0; zoneNdx < zones.length; zoneNdx++) {
        const zone = zones[zoneNdx];
        const boundary = zone.getBoundingClientRect();
        if (click.clientX > boundary.left && click.clientX < boundary.right
            && click.clientY > boundary.top && click.clientY < boundary.bottom) {
            processed = true;
            result[zoneNdx] = result[zoneNdx].concat([click]);
        }
    }
    if (!processed) {
        result[-1] = result[-1].concat([click]);
    }

    return result;
}

function decodeCoordinates(element: HTMLElement, x: number, y: number) {
    const boundary = element.getBoundingClientRect();
    const clientX = x - boundary.left;
    const clientY = y - boundary.top;
    return { clientX, clientY };
}

let decodeCoordinatesWorker : (element: HTMLElement, x: number, y: number) => { clientX: number, clientY: number };

/**
 * Dispatches evens to the corresponing element.
 * @param {string} eventName Name of the event to dispatch.
 * @param {*} touchesMap Map of the touches to zone codes. -1 is the unmapped touches. 
 */
function dispatchTouches(eventName: string, touchesMap: Record<number, Touch[]>) {
    for (const key in touchesMap) {        
        const touches = touchesMap[key];
        if (touches.length) {
            const touchEvent = new TouchEvent(eventName, {
                touches,
                view: window,
                cancelable: true,
                bubbles: true,
            });
            if (parseInt(key) === -1)
                document.dispatchEvent(touchEvent);
	        else {
                const element = zones[key];
                const fakeTouch = {
                    eventName,
                    touches: touches.map(t => {
                        const { clientX, clientY } = decodeCoordinatesWorker(element, t.clientX, t.clientY);
                        return {
                            clientX, 
                            clientY,
                            identifier: t.identifier};
                    }),
                };
                if (!element.contentWindow) {
                    console.error("Element does not have contentWindow property. Cannot dispatch touch event.");
                    return;
                }

                element.contentWindow.postMessage(fakeTouch, "*");
            }
        }
    }
}

/**
 * Dispatches evens to the corresponing element.
 * @param {string} eventName Name of the event to dispatch.
 * @param {*} clickMap Map of the clicks to zone codes. -1 is the unmapped clicks. 
 */
function dispatchClick(eventName: string, clickMap: Record<number, MouseEvent[]>) {
    for (const key in clickMap) {
        const touches = clickMap[key];
        if (parseInt(key) === -1) {
            if (debug) {
                performance.mark("send-touch-click-message-global", { 
                    detail: { clientX: touches[0].clientX, clientY: touches[0].clientY }
                });
            }
            const touchEvent = new MouseEvent(eventName, {
                clientX: touches[0].clientX,
                clientY: touches[0].clientY,
                view: window,
                cancelable: true,
                bubbles: true,
            });
            document.dispatchEvent(touchEvent);
        }
        else {
            const element = zones[key];
            for (const touch of touches) {
                const { clientX, clientY } = decodeCoordinatesWorker(element, touch.clientX, touch.clientY);
                const fakeTouch = {
                    eventName,
                    clientX, 
                    clientY,
                };
                if (debug) {
                    performance.mark("send-touch-relay-message", { 
                        detail: { zone: key, event: fakeTouch }
                    });
                }
                if (!element.contentWindow) {
                    console.error("Element does not have contentWindow property. Cannot dispatch touch event.");
                    return;
                }

                element.contentWindow.postMessage(fakeTouch, "*");
            }
        }
    }
}

function handleStart(e: TouchEvent) {
    if (debug) {
        performance.mark("intercept-touchstart");
    }
    dispatchTouches("touchstart", splitTouches(e.changedTouches));
    e.preventDefault();
}
function handleMove(e: TouchEvent) {
    if (debug) {
        performance.mark("intercept-touchmove");
    }
    dispatchTouches("touchmove", splitTouches(e.changedTouches));
    e.preventDefault();
}
function handleEnd(e: TouchEvent) {
    if (debug) {
        performance.mark("intercept-touchend");
    }
    dispatchTouches("touchend", splitTouches(e.changedTouches));
}
function handleCancel(e: TouchEvent) {
    if (debug) {
        performance.mark("intercept-touchcancel");
    }
    dispatchTouches("touchcancel", splitTouches(e.changedTouches));
}

/**
 * Handle click event
 * @param {MouseEvent} e Information about mouse click
 */
function handleClick(e: MouseEvent) {
    if (debug) {
        performance.mark("intercept-click");
    }
    dispatchClick("click", splitClick(e));
    e.preventDefault();
}

const pointSize = 30;
function colorForTouch(touch: FakeTouch) {
    var color = "#000000";
    switch (touch.identifier) {
        case 0:
            color = "#ff0000";
            break;
        case 1:
            color = "#ff00ff";
            break;
        case 2:
            color = "#0000ff";
            break;
        case 3:
            color = "#00ffff";
            break;
        case 4:
            color = "#00ff00";
            break;
        case 5:
            color = "#ffff00";
            break;
        case 6:
            color = "#ffa800";
            break;
        case 7:
            color = "#ffa8ff";
            break;
        case 8:
            color = "#00a8ff";
            break;
        case 9:
            color = "#a8ffff";
            break;
        case 10:
            color = "#a800ff";
            break;
        default:
            color = "#000000";
    }
    return color;
}

let debug = true;
let debugDelay = 1000;

function relayTouchMessage(evt: MessageEvent<FakeTouchEvent | FakeClickEvent>) {
    if (debug) {
        performance.mark("receive-event", { detail: evt });
    }
    const { eventName } = evt.data;
    if (
        eventName == "touchend" ||
        eventName == "touchstart" ||
        eventName == "touchmove" ||
        eventName == "touchcancel"
    ) {
        const { touches } = evt.data;
        const dehidratedTouches = touches.map((t) => {
            const targetCandidates = document.elementsFromPoint(t.clientX, t.clientY);
            const target = targetCandidates.filter(item => !item.classList.contains("debug-iframe-relay-point"))[0];
            const elementRelativeX = t.clientX;
            const elementRelativeY = t.clientY;
            if (debug) {
                const point = document.createElement("div");
                point.className = "debug-iframe-relay-point point";
                point.id = "touch-" + t.identifier;
                point.style.left = elementRelativeX - pointSize / 2 + "px";
                point.style.top = elementRelativeY - pointSize / 2 + "px";
                point.style.width = "30px";
                point.style.height = "30px";
                point.style.position = "fixed";
                point.style.backgroundColor = colorForTouch(t);
                point.style.borderRadius = "50%";
                point.style.outline =
                    pointSize / 1.2 + "px solid red 40";
                document.body.appendChild(point);
                setTimeout(() => {
                    document.body.removeChild(point);
                }, debugDelay);
            }
            return new Touch({
                identifier: t.identifier,
                clientX: elementRelativeX,
                clientY: elementRelativeY,
                target,
            });
        });
        const touchEvent = new TouchEvent(eventName, {
            touches: dehidratedTouches,
            changedTouches: dehidratedTouches,
            view: window,
            cancelable: true,
            bubbles: true,
        });
        const eventTarget = dehidratedTouches[0].target;
        if (debug) {
            performance.mark("dispatch-event", { detail: { eventName, touches: dehidratedTouches.map(t => { t.identifier, t.clientX, t.clientY }) } });
        }
        eventTarget.dispatchEvent(touchEvent);
    }

    if (eventName == "click") {
        const { clientX, clientY } = evt.data;
        const targetCandidates = document.elementsFromPoint(clientX, clientY);
        const eventTarget = targetCandidates.filter(item => !item.classList.contains("debug-iframe-relay-point"))[0];
        const elementRelativeX = clientX;
        const elementRelativeY = clientY;
        const touchEvent = new MouseEvent(eventName, {
            clientX: elementRelativeX,
            clientY: elementRelativeY,
            view: window,
            cancelable: true,
            bubbles: true,
        });
        eventTarget.dispatchEvent(touchEvent);
    }
}

export function attachTouchRelay(options?: Partial<AttachTouchRelayOptions>) {
    options = options || {};
    debug = options.debug || false;
    window.addEventListener("message", relayTouchMessage, false);
}

export function detachTouchRelay() {
    window.removeEventListener("message", relayTouchMessage, false);
}

let overlay : HTMLDivElement;
export function attachRelayToPage(my_zones: HTMLIFrameElement[], options?: Partial<AttachRelayOptions>) {
    options = options || {};
    debug = options.debug || false;
    decodeCoordinatesWorker = options.decodeCoordinates || decodeCoordinates;
    if (document.getElementById("iframe-relay-touches-overlay")) {
        // The overlay was already attached, not need to do that second time.
        return;
    }

    const box = document.createElement("div");
    box.id = "iframe-relay-touches-overlay"
    box.style.position = "fixed";
    box.style.width = "100%";
    box.style.height = "100%";
    box.style.zIndex = "1000";
    document.body.insertBefore(box, document.body.children[0]);
    box.addEventListener("touchstart", handleStart, false);
    box.addEventListener("touchend", handleEnd, false);
    box.addEventListener("touchcancel", handleCancel, false);
    box.addEventListener("touchmove", handleMove, false);
    box.addEventListener("click", handleClick, false);
    zones = my_zones;
    overlay = box;
}

export function detachRelayToPage() {
    if (!overlay) {
        return;
    }

    overlay.removeEventListener("touchstart", handleStart, false);
    overlay.removeEventListener("touchend", handleEnd, false);
    overlay.removeEventListener("touchcancel", handleCancel, false);
    overlay.removeEventListener("touchmove", handleMove, false);
    overlay.removeEventListener("click", handleClick, false);
    overlay.remove();
}