
let zones;

/**
 * Gets map of split touches.
 * @param {TouchList} touches List of touches to split by zones
 * @returns Map of split touches by zone keys. -1 for regular document.
 */
function splitTouches(touches) {
    const result = {}
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

function decodeCoordinates(element, clientX, clientY) {
    const boundary = element.getBoundingClientRect();
    const clientX = t.clientX - boundary.left;
    const clientY = t.clientY - boundary.top;
    return { clientX, clientY };
}

/**
 * Dispatches evens to the corresponing element.
 * @param {string} eventName Name of the event to dispatch.
 * @param {*} touchesMap Map of the touches to zone codes. -1 is the unmapped touches. 
 */
function dispatchTouches(eventName, touchesMap) {
    for (const key in touchesMap) {
        const element = key == -1 ? document : zones[key];
        const touches = touchesMap[key];
        if (touches.length) {
            const touchEvent = new TouchEvent(eventName, {
                touches,
                view: window,
                cancelable: true,
                bubbles: true,
            });
            if (key == -1)
                document.dispatchEvent(touchEvent);
	        else {
                const fakeTouch = {
                        eventName,
                        touches: touches.map(t => {
                            const { clientX, clientY } = decodeCoordinates(element, t.clientX, t.clientY);
                            return {
                                clientX, 
                                clientY,
                                identifier: t.identifier};
                        }),
                    };
                element.contentWindow.postMessage(fakeTouch, "*");
            }
        }
    }
}

function handleStart(e) {
    var touches = e.changedTouches;
    dispatchTouches("touchstart", splitTouches(e.changedTouches));
    e.preventDefault();
}
function handleMove(e) {
    var touches = e.changedTouches;
    dispatchTouches("touchmove", splitTouches(e.changedTouches));
    e.preventDefault();
}
function handleEnd(e) {
    var touches = e.changedTouches;
    dispatchTouches("touchend", splitTouches(e.changedTouches));
}
function handleCancel(e) {
    handleEnd(e);
    dispatchTouches("touchcancel", splitTouches(e.changedTouches));
}

function relayTouchMessage(evt) {
    const { eventName, touches } = evt.data;
    if (
        eventName == "touchend" ||
        eventName == "touchstart" ||
        eventName == "touchmove" ||
        eventName == "touchcancel"
    ) {
        const dehidratedTouches = touches.map((t) => {
            const target = document.elementFromPoint(t.clientX, t.clientY) || document.body;
            const elementRelativeX = t.clientX;
            const elementRelativeY = t.clientY;
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
        eventTarget.dispatchEvent(touchEvent);
    }
}

export function attachTouchRelay() {
    window.addEventListener("message", relayTouchMessage, false);
}

export function detachTouchRelay() {
    window.removeEventListener("message", relayTouchMessage, false);
}

let overlay;
export function attachRelayToPage(my_zones) {
  const box = document.createElement("div");
  box.style.position = "fixed";
  box.style.width = "100%";
  box.style.height = "100%";
  box.style.zIndex = "1000";
  document.body.insertBefore(box, document.body.children[0]);
  box.addEventListener("touchstart", handleStart, false);
  box.addEventListener("touchend", handleEnd, false);
  box.addEventListener("touchcancel", handleCancel, false);
  box.addEventListener("touchmove", handleMove, false);
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
    overlay.remove();
}