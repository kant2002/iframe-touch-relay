
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
        for (const zoneNdx in zones) {
            const zone = zones[zoneNdx];
            if (touch.clientX > zone.offsetLeft && touch.clientX < zone.offsetLeft + zone.offsetWidth
                && touch.clientY > zone.offsetTop && touch.clientY < zone.offsetTop + zone.offsetHeight) {
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
                            return {
                                clientX: t.clientX - element.offsetLeft, 
                                clientY: t.clientY - element.offsetTop,
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
            const target = document.elementFromPoint(t.clientX, t.clientY);
            return new Touch({
                identifier: t.identifier,
                clientX: t.clientX,
                clientY: t.clientY,
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